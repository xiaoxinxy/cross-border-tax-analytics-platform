"""
E路退 - Pandas 数据清洗与免税测算脚本

用途：
1. 读取 CSV 或 Excel 模板；
2. 用 product_code_db.csv 做 HS 编码/税率辅助匹配；
3. 重新计算是否符合“无票免税”、免税前后利润、节省税费和风险等级；
4. 输出可被网页上传的 CSV / JSON。

示例：
  python pandas_cleaner.py ../data/orders_template.xlsx ../data/product_code_db.csv cleaned_orders.csv cleaned_orders.json

说明：
这是课程项目的技术路线示例，不替代正式税务申报系统。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd


NUMERIC_COLUMNS = [
    "数量",
    "客单价USD",
    "销售额USD",
    "采购成本USD",
    "物流费USD",
    "平台佣金USD",
    "推广费USD",
    "估算税率",
]

OUTPUT_NUMERIC_COLUMNS = [
    "免税前估算税费USD",
    "免税后估算税费USD",
    "节省税费USD",
    "免税前利润USD",
    "免税后利润USD",
    "免税后利润率",
]

REQUIRED_COLUMNS = [
    "订单ID",
    "月份",
    "平台",
    "目的地",
    "类目",
    "商品",
    "HS编码",
    "数量",
    "客单价USD",
    "销售额USD",
    "采购成本USD",
    "物流费USD",
    "平台佣金USD",
    "推广费USD",
    "有进货发票",
    "综试区登记",
    "出口申报完成",
    "非取消退免税货物",
]


def read_orders(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    return pd.read_csv(path, encoding="utf-8-sig")


def read_product_db(path: Path) -> pd.DataFrame:
    db = pd.read_csv(path, encoding="utf-8-sig", dtype={"HS编码": str})
    db["HS编码"] = db["HS编码"].astype(str).str.strip()
    return db


def normalize_yes_no(value: object) -> str:
    text = str(value).strip()
    return "是" if text in {"是", "Y", "y", "yes", "Yes", "TRUE", "true", "1"} else "否"


def risk_level(row: pd.Series) -> str:
    if row["非取消退免税货物"] != "是":
        return "高"
    if row["综试区登记"] != "是" or row["出口申报完成"] != "是":
        return "高"
    if row["免税后利润率"] < 0.08:
        return "高"
    if row["免税后利润率"] < 0.18:
        return "中"
    return "低"


def clean_and_calculate(orders: pd.DataFrame, product_db: pd.DataFrame) -> pd.DataFrame:
    missing = [col for col in REQUIRED_COLUMNS if col not in orders.columns]
    if missing:
        raise ValueError(f"缺少必要字段：{', '.join(missing)}")

    df = orders.copy()
    df["HS编码"] = df["HS编码"].astype(str).str.strip()

    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    for col in ["有进货发票", "综试区登记", "出口申报完成", "非取消退免税货物"]:
        df[col] = df[col].map(normalize_yes_no)

    db = product_db[["HS编码", "默认税率", "是否适用无票免税"]].copy()
    df = df.merge(db, on="HS编码", how="left")
    df["估算税率"] = df["估算税率"].where(df["估算税率"] > 0, df["默认税率"].fillna(0.13))
    df["是否适用无票免税"] = df["是否适用无票免税"].fillna("是")

    no_invoice = df["有进货发票"] == "否"
    eligible = (
        no_invoice
        & (df["综试区登记"] == "是")
        & (df["出口申报完成"] == "是")
        & (df["非取消退免税货物"] == "是")
        & (df["是否适用无票免税"] == "是")
    )

    df["是否符合无票免税"] = eligible.map({True: "是", False: "否"})
    df["免税前估算税费USD"] = (df["销售额USD"] * df["估算税率"]).where(no_invoice, 0).round(2)
    df["免税后估算税费USD"] = df["免税前估算税费USD"].where(~eligible, 0).round(2)
    df["节省税费USD"] = (df["免税前估算税费USD"] - df["免税后估算税费USD"]).round(2)

    base_profit = df["销售额USD"] - df["采购成本USD"] - df["物流费USD"] - df["平台佣金USD"] - df["推广费USD"]
    df["免税前利润USD"] = (base_profit - df["免税前估算税费USD"]).round(2)
    df["免税后利润USD"] = (base_profit - df["免税后估算税费USD"]).round(2)
    df["免税后利润率"] = (df["免税后利润USD"] / df["销售额USD"].replace(0, pd.NA)).fillna(0).round(4)
    df["风险等级"] = df.apply(risk_level, axis=1)

    df = df.drop(columns=["默认税率", "是否适用无票免税"], errors="ignore")
    for col in OUTPUT_NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    return df


def write_outputs(df: pd.DataFrame, csv_path: Path, json_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    records = json.loads(df.to_json(orient="records", force_ascii=False))
    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit(
            "用法：python pandas_cleaner.py 输入订单CSV或Excel 商品编码库CSV 输出CSV 输出JSON"
        )

    input_path = Path(sys.argv[1])
    db_path = Path(sys.argv[2])
    csv_path = Path(sys.argv[3])
    json_path = Path(sys.argv[4])

    orders = read_orders(input_path)
    product_db = read_product_db(db_path)
    cleaned = clean_and_calculate(orders, product_db)
    write_outputs(cleaned, csv_path, json_path)
    print(f"已清洗并测算 {len(cleaned)} 条订单：{csv_path} / {json_path}")


if __name__ == "__main__":
    main()
