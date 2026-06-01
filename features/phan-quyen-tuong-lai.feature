Feature: Phân quyền người dùng trong iChess Center OS

  # User Story 1: Phân quyền theo vai trò
  # Là Quản trị tổng
  # Tôi muốn phân quyền người dùng theo vai trò và cơ sở
  # Để mỗi người chỉ nhìn thấy đúng dữ liệu và chức năng mình được phép thao tác

  # Acceptance Criteria:
  # - Quản trị tổng có quyền cao nhất
  # - Quản trị tổng có thể xem tất cả cơ sở
  # - Quản trị tổng có thể chuyển sang góc nhìn của một Quản lý cơ sở để hỗ trợ
  # - Quản lý cơ sở chỉ thấy dữ liệu của cơ sở mình
  # - Giáo viên, phụ huynh, học viên là các vai trò phase sau
  # - Phase đầu chưa cần đăng nhập thật hoặc database thật

  Scenario: Quản lý cơ sở chỉ thấy dữ liệu cơ sở mình
    Given người dùng có vai trò "Quản lý cơ sở"
    And người dùng thuộc cơ sở "DreamHome"
    When người dùng mở dashboard
    Then hệ thống chỉ hiển thị dữ liệu của cơ sở "DreamHome"

  Scenario: Quản trị tổng xem danh sách cơ sở
    Given người dùng có vai trò "Quản trị tổng"
    When người dùng mở dashboard tổng
    Then hệ thống hiển thị danh sách tất cả cơ sở
    And hệ thống hiển thị số liệu tổng quan của từng cơ sở

  Scenario: Quản trị tổng chuyển sang góc nhìn Quản lý cơ sở
    Given người dùng có vai trò "Quản trị tổng"
    And hệ thống có cơ sở "DreamHome"
    When người dùng chọn "Xem như Quản lý cơ sở DreamHome"
    Then hệ thống hiển thị dashboard của cơ sở DreamHome
    And hệ thống vẫn ghi nhận người dùng gốc là Quản trị tổng

  Scenario: Khóa tài khoản nhân sự
    Given người dùng có vai trò "Quản trị tổng"
    And có một nhân sự đang hoạt động trong hệ thống
    When người dùng khóa tài khoản nhân sự đó
    Then nhân sự không còn được truy cập hệ thống
    And dữ liệu lịch sử của nhân sự vẫn được giữ lại
