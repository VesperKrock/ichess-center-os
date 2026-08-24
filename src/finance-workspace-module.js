export function renderFinanceWorkspaceModule() {
  return `
    <section class="finance-workspace-module" aria-labelledby="finance-workspace-title">
      <div class="finance-workspace-header">
        <div>
          <h3 id="finance-workspace-title">Nhóm Tài chính</h3>
          <p>Xem nhanh và mở các khu vực tài chính đang dùng của cơ sở.</p>
        </div>
      </div>

      <div class="finance-workspace-overview" aria-label="Tổng quan tài chính">
        <article>
          <span>Tổng quan</span>
          <strong>Khu vực tài chính</strong>
          <p>Mở Sổ quỹ để xem số dư và đối soát; mở Thu chi để xem các khoản thu, chi.</p>
        </article>
        <article>
          <span>Dữ liệu hiện tại</span>
          <strong>Xem theo từng khu vực</strong>
          <p>Sổ quỹ và Thu chi hiển thị dữ liệu tài chính hiện có của cơ sở khi được mở.</p>
        </article>
      </div>

      <div class="finance-workspace-sections" aria-label="Lối vào nghiệp vụ tài chính">
        <article class="finance-workspace-card is-primary">
          <div>
            <span>1</span>
            <h4>Sổ quỹ</h4>
            <p>Theo dõi số dư, đối soát và trạng thái chốt sổ theo ngày.</p>
            <small>Việc đối soát được thực hiện trong Sổ quỹ.</small>
          </div>
          <button type="button" data-finance-open-module="so-quy">Xem Sổ quỹ</button>
        </article>

        <article class="finance-workspace-card">
          <div>
            <span>2</span>
            <h4>Thu chi</h4>
            <p>Ghi nhận khoản thu, khoản chi và quản lý các giao dịch hiện có.</p>
          </div>
          <button type="button" data-finance-open-module="thu-chi">Xem Thu chi</button>
        </article>
      </div>
    </section>
  `
}
