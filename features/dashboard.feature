Feature: Dashboard dạng desktop cho Quản lý cơ sở

  # User Story 1: Xem module dạng ô vuông
  # Là một Quản lý cơ sở
  # Tôi muốn nhìn thấy các chức năng dưới dạng các nút vuông
  # Để dễ bấm, dễ hiểu và giống một màn hình desktop quản lý

  # Acceptance Criteria:
  # - Nền tổng thể màu đen hoặc gần đen
  # - Mỗi chức năng là một nút/card vuông hoặc gần vuông
  # - Nút chỉ cần ghi tên chức năng, chưa cần icon
  # - Có đủ các module giai đoạn đầu
  # - Có thể chuyển giữa dạng ô vuông và dạng danh sách
  # - Giao diện ưu tiên laptop/desktop

  Scenario: Hiển thị danh sách module dạng ô vuông
    Given người dùng đang ở dashboard DreamHome
    When hệ thống tải xong giao diện
    Then hệ thống hiển thị các module dưới dạng ô vuông
    And mỗi ô hiển thị tên chức năng rõ ràng
    And nền trang là màu đen hoặc gần đen

  Scenario: Chuyển sang dạng danh sách
    Given người dùng đang ở dashboard DreamHome
    When người dùng chọn chế độ "Dạng danh sách"
    Then hệ thống hiển thị module dưới dạng danh sách dài
    And mỗi module có tên đầy đủ dễ đọc

  Scenario: Ghi nhớ chế độ hiển thị
    Given người dùng đã chọn một chế độ hiển thị
    When người dùng tải lại trang
    Then hệ thống vẫn giữ chế độ hiển thị đã chọn bằng localStorage

  Scenario: Không dùng ảnh nền trong phase đầu
    Given hệ thống đang ở phase dựng khung giao diện
    When dashboard được hiển thị
    Then hệ thống không hiển thị ảnh nền
    And hệ thống không ưu tiên trang trí phức tạp
