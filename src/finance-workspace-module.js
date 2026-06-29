export function renderFinanceWorkspaceModule() {
  return `
    <section class="finance-workspace-module" aria-labelledby="finance-workspace-title">
      <div class="finance-workspace-header">
        <div>
          <h3 id="finance-workspace-title">Nhóm Tài chính</h3>
          <p>Wrapper UI an toàn cho Sổ quỹ và Thu chi. Sổ quỹ đặt trước Thu chi, không merge logic.</p>
        </div>
      </div>

      <div class="finance-workspace-overview" aria-label="Tổng quan tài chính">
        <article>
          <span>Tổng quan</span>
          <strong>Tài chính</strong>
          <p>Không đổi công thức, storage hoặc dữ liệu tài chính hiện có.</p>
        </article>
        <article>
          <span>Dashboard nâng cao</span>
          <strong>Phase sau</strong>
          <p>Ngày/tuần/quý/năm sẽ cần aggregation chuẩn trước khi hiển thị số liệu.</p>
        </article>
      </div>

      <div class="finance-workspace-sections" aria-label="Lối vào nghiệp vụ tài chính">
        <article class="finance-workspace-card is-primary">
          <div>
            <span>1</span>
            <h4>Sổ quỹ</h4>
            <p>Theo dõi số dư, đối soát và trạng thái chốt sổ theo ngày bằng module Sổ quỹ hiện có.</p>
            <small>Đối soát nằm trong Sổ quỹ, chưa tách thành module riêng.</small>
          </div>
          <button type="button" data-finance-open-module="so-quy">Xem Sổ quỹ</button>
        </article>

        <article class="finance-workspace-card">
          <div>
            <span>2</span>
            <h4>Thu chi</h4>
            <p>Ghi nhận khoản thu, khoản chi và quản lý giao dịch bằng module Thu chi hiện có.</p>
          </div>
          <button type="button" data-finance-open-module="thu-chi">Xem Thu chi</button>
        </article>
      </div>
    </section>
  `
}
