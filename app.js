const state = {
  rows: [],
  query: "",
  grade: "",
};

const els = {
  subtitle: document.querySelector("#subtitle"),
  tradeDate: document.querySelector("#tradeDate"),
  exportedAt: document.querySelector("#exportedAt"),
  rowCount: document.querySelector("#rowCount"),
  searchInput: document.querySelector("#searchInput"),
  gradeFilter: document.querySelector("#gradeFilter"),
  rows: document.querySelector("#rows"),
  emptyState: document.querySelector("#emptyState"),
};

function formatChange(value) {
  const number = Number(value || 0);
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(2)}%`;
}

function rowTemplate(row) {
  const changeClass = row.change_pct >= 0 ? "up" : "down";
  return `
    <article class="row">
      <div class="rank">#${row.rank}</div>
      <div>
        <span class="stock-name">${row.name}</span>
        <span class="stock-code">${row.code}</span>
      </div>
      <div class="score">${row.score.toFixed(1)}</div>
      <div class="grade">${row.grade}</div>
      <div class="change ${changeClass}">${formatChange(row.change_pct)}</div>
    </article>
  `;
}

function render() {
  const query = state.query.trim().toLowerCase();
  const rows = state.rows.filter((row) => {
    const matchesQuery =
      !query ||
      row.name.toLowerCase().includes(query) ||
      row.code.toLowerCase().includes(query);
    const matchesGrade = !state.grade || row.grade === state.grade;
    return matchesQuery && matchesGrade;
  });

  els.rows.innerHTML = rows.map(rowTemplate).join("");
  els.emptyState.hidden = rows.length > 0;
}

async function boot() {
  const response = await fetch("./data/fundflow.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`snapshot load failed: ${response.status}`);
  }
  const snapshot = await response.json();
  state.rows = snapshot.rows || [];

  const meta = snapshot.meta || {};
  els.subtitle.textContent = "本地私有计算后的公开只读结果，不包含公式和因子明细。";
  els.tradeDate.textContent = meta.trade_date_label || "--";
  els.exportedAt.textContent = meta.exported_at || "--";
  els.rowCount.textContent = String(meta.row_count || state.rows.length || 0);

  const grades = [...new Set(state.rows.map((row) => row.grade).filter(Boolean))];
  for (const grade of grades) {
    const option = document.createElement("option");
    option.value = grade;
    option.textContent = grade;
    els.gradeFilter.appendChild(option);
  }

  render();
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.gradeFilter.addEventListener("change", (event) => {
  state.grade = event.target.value;
  render();
});

boot().catch((error) => {
  els.subtitle.textContent = "公开快照加载失败，请重新导出 data/fundflow.json。";
  console.error(error);
});
