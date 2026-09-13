export function renderFinanceWorkspaceModule() {
  return `
    <section class="finance-workspace-module" aria-labelledby="finance-workspace-title">
      <header class="finance-workspace-header" aria-label="Xem nhanh và mở các khu vực tài chính đang dùng của cơ sở.">
        <div>
          <h3 id="finance-workspace-title">Nhóm Tài chính</h3>
          <p>Quản lý dòng tiền, đối soát quỹ và giao dịch thu chi của cơ sở.</p>
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
          <p>Theo dõi số dư, đối soát và trạng thái chốt sổ theo ngày.</p>
          <div class="finance-workspace-divider" aria-hidden="true"></div>
          <strong class="finance-workspace-use-label">Dùng để</strong>
          <ul>
            <li>Kiểm tra số dư đầu ngày và cuối ngày</li>
            <li>Đối soát tiền thực tế với hệ thống</li>
            <li>Chốt sổ và xem lịch sử đối soát</li>
          </ul>
          <button type="button" data-finance-open-module="so-quy" aria-label="Xem Sổ quỹ">
            <span>Mở Sổ quỹ</span><span aria-hidden="true">→</span>
          </button>
        </article>

        <article class="finance-workspace-card">
          <span class="finance-workspace-number">02</span>
          <h4>Thu chi</h4>
          <p>Ghi nhận và quản lý các giao dịch thu, chi của cơ sở.</p>
          <div class="finance-workspace-divider" aria-hidden="true"></div>
          <strong class="finance-workspace-use-label">Dùng để</strong>
          <ul>
            <li>Ghi nhận khoản thu và khoản chi</li>
            <li>Quản lý danh mục và chứng từ giao dịch</li>
            <li>Lọc, tìm kiếm và xuất dữ liệu giao dịch</li>
          </ul>
          <button type="button" data-finance-open-module="thu-chi" aria-label="Xem Thu chi">
            <span>Mở Thu chi</span><span aria-hidden="true">→</span>
          </button>
        </article>
      </div>

      <section class="finance-workspace-future" aria-label="Phân tích tài chính nâng cao">
        <h4>Phân tích tài chính nâng cao</h4>
        <p>Báo cáo dòng tiền, xu hướng thu chi và dự báo tài chính.</p>
        <div>
          <span>GIAI ĐOẠN SAU</span>
          <p>Khu vực này sẽ được triển khai sau khi dữ liệu tài chính vận hành ổn định.</p>
        </div>
      </section>
    </section>
  `
}
