Feature: Phòng chức năng có cấu trúc

  # User Story 1: Mở phòng chức năng từ dashboard
  # Là một Quản lý cơ sở
  # Tôi muốn bấm vào từng module để mở ra một phòng chức năng riêng có cấu trúc rõ ràng
  # Để sau này có thể lấp đầy từng phòng bằng chức năng thật mà không làm lệch khung ban đầu

  # Acceptance Criteria:
  # - Bấm vào module nào thì mở đúng phòng của module đó
  # - Phòng chức năng hiển thị tên module
  # - Phòng chức năng hiển thị mô tả ngắn của module
  # - Phòng chức năng hiển thị trạng thái module
  # - Phòng chức năng hiển thị danh sách Chức năng dự kiến
  # - Phòng chức năng hiển thị danh sách Dữ liệu dự kiến
  # - Phòng chức năng có thông báo module đang ở giai đoạn khung
  # - Có nút quay lại dashboard
  # - Chưa làm nghiệp vụ thật trong phase này
  # - Chưa có form nhập liệu thật
  # - Chưa lưu dữ liệu nghiệp vụ thật

  Scenario: Mở phòng chức năng Học viên có cấu trúc
    Given người dùng đang ở dashboard DreamHome
    When người dùng bấm module "Học viên"
    Then hệ thống mở phòng chức năng "Học viên"
    And hệ thống hiển thị mô tả ngắn của module
    And hệ thống hiển thị trạng thái module
    And hệ thống hiển thị danh sách "Chức năng dự kiến"
    And hệ thống hiển thị danh sách "Dữ liệu dự kiến"
    And hệ thống hiển thị thông báo module đang ở giai đoạn khung
    And hệ thống hiển thị nút "Quay lại dashboard"

  Scenario: Mở phòng chức năng Học phí có cấu trúc
    Given người dùng đang ở dashboard DreamHome
    When người dùng bấm module "Học phí"
    Then hệ thống mở phòng chức năng "Học phí"
    And hệ thống hiển thị mô tả ngắn của module
    And hệ thống hiển thị trạng thái module
    And hệ thống hiển thị các chức năng dự kiến liên quan đến học phí
    And hệ thống hiển thị các dữ liệu dự kiến liên quan đến học phí
    And hệ thống chưa yêu cầu nhập dữ liệu thật

  Scenario: Quay lại dashboard từ phòng chức năng
    Given người dùng đang ở một phòng chức năng bất kỳ
    When người dùng bấm "Quay lại dashboard"
    Then hệ thống quay về dashboard DreamHome

  Scenario: Không mở rộng nghiệp vụ trong phase module room có cấu trúc
    Given người dùng mở một phòng chức năng
    When phòng chức năng được hiển thị
    Then hệ thống chỉ hiển thị khung module có cấu trúc
    And hệ thống chưa hiển thị form nhập liệu chi tiết
    And hệ thống chưa thực hiện thao tác CRUD thật
    And hệ thống chưa lưu dữ liệu nghiệp vụ thật
