# -*- coding: utf-8 -*-
"""Build styled Excel/CSV data packs for the E路退 demo."""
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


DATA_DIR = Path(__file__).resolve().parents[1] / "data"

FILES = {
    "样本A_综合均衡": "orders_a_balanced.csv",
    "样本B_高利润版": "orders_b_high_profit.csv",
    "样本C_高风险版": "orders_c_high_risk.csv",
    "样本D_平台对比版": "orders_d_platform_compare.csv",
}

CATEGORY_META = [
    ["A", "综合均衡型", "完整流程演示", "销售、利润、节税和风险都比较均衡，适合作为首页默认样本。", "中低"],
    ["B", "盈利强化型", "利润提升演示", "高利润率订单占比更高，适合说明免税政策对利润改善的价值。", "低"],
    ["C", "风控预警型", "异常识别演示", "登记、申报、适用货物等问题更集中，适合展示风险提醒。", "高"],
    ["D", "平台经营型", "平台对比演示", "对比 Amazon、Temu、Shopee、TikTok Shop 的渠道表现。", "中"],
]


def read_sample(name: str) -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / FILES[name])
    df["样本名称"] = name
    return df


def add_sheet_from_df(wb: Workbook, title: str, df: pd.DataFrame):
    sh = wb.create_sheet(title[:31])
    sh.append(list(df.columns))
    for row in df.itertuples(index=False):
        sh.append(list(row))
    return sh


def style_sheet(sh):
    max_row, max_col = sh.max_row, sh.max_column
    header_fill = PatternFill("solid", fgColor="17365D")
    stripe_fill = PatternFill("solid", fgColor="EAF2F8")
    header_font = Font(name="Microsoft YaHei", size=10, color="FFFFFF", bold=True)
    body_font = Font(name="Microsoft YaHei", size=10)
    thin = Side(style="thin", color="D9E2F3")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for row in sh.iter_rows():
        for cell in row:
            cell.font = body_font
            cell.border = border
            cell.alignment = Alignment(vertical="center", wrap_text=True)

    for cell in sh[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row in range(2, max_row + 1):
        sh.row_dimensions[row].height = 22
        if row % 2 == 0:
            for col in range(1, max_col + 1):
                sh.cell(row=row, column=col).fill = stripe_fill

    sh.freeze_panes = "A2"
    sh.auto_filter.ref = sh.dimensions
    sh.sheet_view.showGridLines = False

    for col in range(1, max_col + 1):
        values = [str(sh.cell(row=r, column=col).value or "") for r in range(1, min(max_row, 80) + 1)]
        width = min(28, max(10, max(len(v) for v in values) + 2))
        sh.column_dimensions[get_column_letter(col)].width = width

    if max_row >= 2 and max_col >= 2:
        ref = f"A1:{get_column_letter(max_col)}{max_row}"
        safe_title = "".join(ch for ch in sh.title if ch.isalnum())[:20] or "Table"
        table = Table(displayName=f"T_{safe_title}_{len(sh.title)}", ref=ref)
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False,
            showRowStripes=True, showColumnStripes=False
        )
        sh.add_table(table)

    headers = {sh.cell(row=1, column=c).value: c for c in range(1, max_col + 1)}
    for key in ["免税后利润USD", "节省税费USD", "免税后利润率", "利润提升率"]:
        col = headers.get(key)
        if col and max_row >= 3:
            rng = f"{get_column_letter(col)}2:{get_column_letter(col)}{max_row}"
            sh.conditional_formatting.add(
                rng,
                ColorScaleRule(
                    start_type="min", start_color="FCE4D6",
                    mid_type="percentile", mid_value=50, mid_color="FFF2CC",
                    end_type="max", end_color="D9EAD3",
                ),
            )

    risk_col = headers.get("风险等级")
    if risk_col and max_row >= 2:
        rng = f"{get_column_letter(risk_col)}2:{get_column_letter(risk_col)}{max_row}"
        sh.conditional_formatting.add(
            rng,
            CellIsRule(operator="equal", formula=['"高"'], fill=PatternFill("solid", fgColor="F4CCCC")),
        )

    sh.sheet_properties.pageSetUpPr.fitToPage = True
    sh.page_setup.fitToWidth = 1


def main():
    frames = {name: read_sample(name) for name in FILES}
    all_df = pd.concat(frames.values(), ignore_index=True)

    summary_rows = []
    for name, df in frames.items():
        revenue = df["销售额USD"].sum()
        before = df["免税前利润USD"].sum()
        after = df["免税后利润USD"].sum()
        saving = df["节省税费USD"].sum()
        summary_rows.append({
            "样本名称": name,
            "订单数": len(df),
            "销售额USD": round(revenue, 2),
            "免税前利润USD": round(before, 2),
            "免税后利润USD": round(after, 2),
            "节省税费USD": round(saving, 2),
            "利润提升率": round((after - before) / max(1, abs(before)), 4),
            "免税后利润率": round(after / max(1, revenue), 4),
            "符合免税订单数": int((df["是否符合无票免税"] == "是").sum()),
            "高风险订单数": int((df["风险等级"] == "高").sum()),
        })
    summary_df = pd.DataFrame(summary_rows)

    platform_df = all_df.groupby(["样本名称", "平台"], as_index=False).agg({
        "订单ID": "count",
        "销售额USD": "sum",
        "免税后利润USD": "sum",
        "节省税费USD": "sum",
    }).rename(columns={"订单ID": "订单数"})
    platform_df["免税后利润率"] = (platform_df["免税后利润USD"] / platform_df["销售额USD"]).round(4)

    category_df = all_df.groupby(["样本名称", "类目"], as_index=False).agg({
        "订单ID": "count",
        "销售额USD": "sum",
        "免税后利润USD": "sum",
        "节省税费USD": "sum",
    }).rename(columns={"订单ID": "订单数"})
    category_df["节税贡献占比"] = category_df.groupby("样本名称")["节省税费USD"].transform(lambda s: (s / s.sum()).round(4))

    summary_df.to_csv(DATA_DIR / "sample_summary_table.csv", index=False, encoding="utf-8-sig")
    platform_df.round(2).to_csv(DATA_DIR / "platform_summary_table.csv", index=False, encoding="utf-8-sig")
    category_df.round(2).to_csv(DATA_DIR / "category_summary_table.csv", index=False, encoding="utf-8-sig")

    wb = Workbook()
    ws = wb.active
    ws.title = "样本分类说明"
    ws.append(["编号", "分类", "用途", "说明", "风险重点"])
    for row in CATEGORY_META:
        ws.append(row)

    add_sheet_from_df(wb, "经营汇总表", summary_df)
    add_sheet_from_df(wb, "平台汇总表", platform_df.round(2))
    add_sheet_from_df(wb, "类目汇总表", category_df.round(2))
    add_sheet_from_df(wb, "商品编码库", pd.read_csv(DATA_DIR / "product_code_db.csv"))
    for name, df in frames.items():
        add_sheet_from_df(wb, name.replace("_", "")[:31], df.drop(columns=["样本名称"]))

    for sheet in wb.worksheets:
        style_sheet(sheet)

    out = DATA_DIR / "E路退_表格样式数据包.xlsx"
    wb.save(out)
    print(f"created: {out}")


if __name__ == "__main__":
    main()
