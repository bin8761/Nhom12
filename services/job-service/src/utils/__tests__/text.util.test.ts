import { normalizeVietnameseText } from '../text';

describe('normalizeVietnameseText', () => {
  it('loại bỏ dấu và chuẩn hóa khoảng trắng', () => {
    expect(normalizeVietnameseText('  Hà    Nội  ')).toBe('ha noi');
  });

  it('xử lý tiếng Việt có dấu phức tạp', () => {
    expect(normalizeVietnameseText('Thủ Đức')).toBe('thu duc');
    expect(normalizeVietnameseText('Đắk Lắk')).toBe('dak lak');
  });

  it('chuyển về lowercase và giữ ký tự a-z/0-9', () => {
    expect(normalizeVietnameseText('Q.1 - Hồ Chí Minh')).toBe('q.1 - ho chi minh');
  });

  it('trả về chuỗi rỗng nếu input toàn khoảng trắng', () => {
    expect(normalizeVietnameseText('   ')).toBe('');
  });
});
