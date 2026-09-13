export function renderFinanceWorkspaceModule() {
  return `
    <section class="finance-workspace-module" aria-labelledby="finance-workspace-title">
      <header class="finance-workspace-header" aria-label="Xem nhanh và mở các khu vực tài chính đang dùng của cơ sở.">
        <div>
          <h3 id="finance-workspace-title">Nhóm Tài chính</h3>
          <p>Truy cập Sổ quỹ và Thu chi trong cùng một khu vực tài chính.</p>
        </div>
        <aside class="finance-workspace-meta" aria-label="Dữ liệu hiện tại · Xem theo từng khu vực">
          <span>2 khu vực nghiệp vụ</span>
          <strong>Sổ quỹ trước · Thu chi sau</strong>
        </aside>
      </header>

      <div class="finance-workspace-sections" aria-label="Lối vào nghiệp vụ tài chính">
        <article class="finance-workspace-card" aria-description="Việc đối soát được thực hiện trong Sổ quỹ">
          <span class="finance-workspace-number">01</span>
          <h4>Sổ quỹ</h4>
          <p>Theo dõi trạng thái quỹ và các bước kiểm soát số dư hằng ngày.</p>
          <div class="finance-workspace-divider" aria-hidden="true"></div>
          <strong class="finance-workspace-use-label">Dùng để</strong>
          <ul>
            <li>Theo dõi số dư quỹ</li>
            <li>Đối soát số liệu</li>
            <li>Chốt sổ theo ngày</li>
          </ul>
          <button type="button" data-finance-open-module="so-quy" aria-label="Xem Sổ quỹ">
            <span>Mở Sổ quỹ</span><span aria-hidden="true">→</span>
          </button>
        </article>

        <article class="finance-workspace-card">
          <span class="finance-workspace-number">02</span>
          <h4>Thu chi</h4>
          <p>Ghi nhận và quản lý các giao dịch phát sinh trong hoạt động trung tâm.</p>
          <div class="finance-workspace-divider" aria-hidden="true"></div>
          <strong class="finance-workspace-use-label">Dùng để</strong>
          <ul>
            <li>Ghi nhận khoản thu</li>
            <li>Ghi nhận khoản chi</li>
            <li>Quản lý danh sách giao dịch</li>
          </ul>
          <button type="button" data-finance-open-module="thu-chi" aria-label="Xem Thu chi">
            <span>Mở Thu chi</span><span aria-hidden="true">→</span>
          </button>
        </article>
      </div>

      <section class="finance-workspace-future" aria-label="Phân tích tài chính nâng cao">
        <h4>Phân tích tài chính nâng cao</h4>
        <p>Theo ngày / tuần / quý / năm</p>
        <div>
          <span>PHASE SAU</span>
          <p>Sẽ bổ sung khi dữ liệu tổng hợp sẵn sàng; hiện tại không ảnh hưởng Sổ quỹ và Thu chi.</p>
        </div>
      </section>
    </section>
  `
}
