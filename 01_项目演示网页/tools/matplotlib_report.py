"""
E路退 Matplotlib 报告脚本

运行方式：
  pip install matplotlib pandas
  python matplotlib_report.py ../data/orders_sample.csv ../data/report_charts

说明：
如果运行环境没有 matplotlib，可以只使用网页内置图表；本文件用于对应题目
建议中的“ECharts 或 Matplotlib 生成报告”技术路线。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("用法：python matplotlib_report.py 输入CSV 输出文件夹")

    try:
        import matplotlib.pyplot as plt
    except ModuleNotFoundError as exc:
        raise SystemExit("当前环境未安装 matplotlib，请先执行：pip install matplotlib") from exc

    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(input_path, encoding="utf-8-sig")
    plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "Arial Unicode MS"]
    plt.rcParams["axes.unicode_minus"] = False

    platform = df.groupby("平台")["销售额USD"].sum().sort_values(ascending=False)
    category = df.groupby("类目")["节省税费USD"].sum().sort_values(ascending=False)

    ax = platform.plot(kind="bar", title="平台销售额对比", color="#265DFF", figsize=(8, 4))
    ax.set_ylabel("销售额 USD")
    plt.tight_layout()
    plt.savefig(output_dir / "platform_revenue.png", dpi=180)
    plt.close()

    ax = category.plot(kind="bar", title="类目节税贡献", color="#10A875", figsize=(8, 4))
    ax.set_ylabel("节省税费 USD")
    plt.tight_layout()
    plt.savefig(output_dir / "category_saving.png", dpi=180)
    plt.close()

    print(f"已生成 Matplotlib 图表：{output_dir}")


if __name__ == "__main__":
    main()
