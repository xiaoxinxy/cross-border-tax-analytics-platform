"""
E路退 Streamlit 原型

运行方式：
  pip install -r requirements_optional.txt
  streamlit run streamlit_app.py

说明：
本文件用于对应题目建议中的 Streamlit 技术路径。正式交付仍可直接打开
../index.html；Streamlit 版适合展示“Python + Pandas + 快速数据应用”的实现思路。
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from pandas_cleaner import clean_and_calculate, read_product_db


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"


st.set_page_config(page_title="E路退 Streamlit 原型", layout="wide")
st.title("E路退：跨境小包“无票免税”计算器")
st.caption("Python + Pandas + Streamlit 技术路线示例")

uploaded = st.file_uploader("上传订单 CSV / Excel", type=["csv", "xlsx", "xls"])
sample_path = DATA_DIR / "orders_sample.csv"
db_path = DATA_DIR / "product_code_db.csv"

if uploaded is None:
    raw = pd.read_csv(sample_path, encoding="utf-8-sig")
    st.info("当前使用内置样本数据。也可以上传 CSV / Excel 模板。")
else:
    if uploaded.name.lower().endswith((".xlsx", ".xls")):
        raw = pd.read_excel(uploaded)
    else:
        raw = pd.read_csv(uploaded, encoding="utf-8-sig")

product_db = read_product_db(db_path)
df = clean_and_calculate(raw, product_db)

total_revenue = df["销售额USD"].sum()
total_profit = df["免税后利润USD"].sum()
total_saving = df["节省税费USD"].sum()
high_risk = int((df["风险等级"] == "高").sum())

col1, col2, col3, col4 = st.columns(4)
col1.metric("销售额合计", f"${total_revenue:,.0f}")
col2.metric("免税后利润", f"${total_profit:,.0f}")
col3.metric("节省税费", f"${total_saving:,.0f}")
col4.metric("高风险订单", f"{high_risk} 单")

left, right = st.columns(2)
with left:
    st.subheader("平台销售额")
    st.bar_chart(df.groupby("平台")["销售额USD"].sum())
with right:
    st.subheader("类目节税贡献")
    st.bar_chart(df.groupby("类目")["节省税费USD"].sum())

st.subheader("订单明细")
st.dataframe(df, use_container_width=True)

st.download_button(
    "下载清洗后 CSV",
    df.to_csv(index=False, encoding="utf-8-sig"),
    file_name="cleaned_orders.csv",
    mime="text/csv",
)
