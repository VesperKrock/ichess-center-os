Feature: Quản lý cơ sở DreamHome

  # User Story 1: Vào bàn điều hành cơ sở
  # Là một Quản lý cơ sở
  # Tôi muốn mở được bàn điều hành của cơ sở DreamHome
  # Để nhìn thấy các chức năng quản lý chính và bắt đầu thao tác nhanh

  # Acceptance Criteria:
  # - Hiển thị tên hệ thống iChess Center OS
  # - Hiển thị cơ sở hiện tại là DreamHome
  # - Hiển thị vai trò hiện tại là Quản lý cơ sở
  # - Hiển thị các module chính bằng nút vuông trên nền đen
  # - Chưa yêu cầu đăng nhập thật trong giai đoạn đầu
  # - Chưa kết nối database thật trong giai đoạn đầu

  Scenario: Mở dashboard cơ sở thành công
    Given người dùng đang ở bản web local của iChess Center OS
    When người dùng mở trang chính
    Then hệ thống hiển thị dashboard của cơ sở DreamHome
    And hệ thống hiển thị vai trò "Quản lý cơ sở"
    And hệ thống hiển thị danh sách module quản lý chính

  Scenario: Dashboard chưa cần đăng nhập thật
    Given hệ thống đang ở giai đoạn prototype quản lý cơ sở
    When người dùng mở trang web local
    Then hệ thống cho phép vào thẳng dashboard DreamHome
    And hệ thống không yêu cầu tài khoản thật
    And hệ thống không kết nối database thật
