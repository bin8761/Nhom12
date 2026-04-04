import { CVParserService } from '../cvParserService';

describe('CVParserService', () => {
  const parser = new CVParserService(['javascript', 'node.js', 'aws', 'docker']);

  it('extracts email in different formats', () => {
    const result = parser.parse('Contact me at user.name+test@example.com');
    expect(result.email).toBe('user.name+test@example.com');
  });

  it('extracts phone number in Vietnamese formats', () => {
    const result = parser.parse('Phone: +84 912 345 678 or 0912.345.678');
    expect(result.phone).toBe('+84912345678');
  });

  it('matches skills based on dictionary', () => {
    const result = parser.parse('Experienced with JavaScript, AWS and Docker orchestration.');
    expect(result.skills).toEqual(expect.arrayContaining(['Javascript', 'Aws', 'Docker']));
  });

  it('extracts years of experience via regex', () => {
    const result = parser.parse('I have 5+ years experience building APIs.');
    expect(result.yearsExperience).toBe(5);
  });

  it('captures education entries from keyword lines', () => {
    const result = parser.parse('Cử nhân Công nghệ thông tin - Đại học Bách Khoa HCM\nKinh nghiệm khác...');
    expect(result.education).toEqual(
      expect.arrayContaining([{ institution: 'Cử nhân Công nghệ thông tin - Đại học Bách Khoa HCM' }]),
    );
  });

  it('produces summary from first paragraph', () => {
    const text = `Senior backend engineer with 7 years experience building Node.js services.

Achievements:
- Built scalable APIs
- Led DevOps initiatives`;
    const result = parser.parse(text);
    expect(result.summary).toBe(
      'Senior backend engineer with 7 years experience building Node.js services.',
    );
  });

  it('extracts structured sections for experience, certificates, activities and objective', () => {
    const text = `
Mục tiêu nghề nghiệp
Trở thành trưởng nhóm kỹ sư bảo trì tại một tập đoàn khách sạn quốc tế.

Kinh nghiệm làm việc
Trưởng phòng Kỹ Thuật
Khách sạn Châu Nga | 05/2020 - Nay
- Quản lý đội bảo trì 10 người và tối ưu chi phí vận hành.

Kỹ sư Bảo trì
Khu nghỉ dưỡng Mai Phương
07/2017 - 03/2020

Chứng chỉ
- PMP Certification
- Six Sigma Green Belt

Hoạt động
Tình nguyện viên Green Earth | 2019
`;
    const result = parser.parse(text);

    expect(result.objective).toContain('Trở thành trưởng nhóm kỹ sư');
    expect(result.experience).toHaveLength(2);
    expect(result.experience?.[0]).toMatchObject({
      position: 'Trưởng phòng Kỹ Thuật',
      company: 'Khách sạn Châu Nga',
      duration: '05/2020 - Nay',
    });
    expect(result.experience?.[0]?.description).toMatch(/tối ưu chi phí/);
    expect(result.experience?.[1]).toMatchObject({
      position: 'Kỹ sư Bảo trì',
      company: 'Khu nghỉ dưỡng Mai Phương',
      duration: '07/2017 - 03/2020',
    });
    expect(result.certificates).toEqual(
      expect.arrayContaining(['PMP Certification', 'Six Sigma Green Belt']),
    );
    expect(result.activities).toEqual(
      expect.arrayContaining(['Tình nguyện viên Green Earth | 2019']),
    );
  });

  it('handles inline headings, uppercase sections and noisy lines', () => {
    const text = `
Tri Anh Chuyên viên quan hệ khách hàng Ngày sinh: 24/08/1996
MỤC TIÊU NGHỀ NGHIỆP Trở thành trưởng phòng quan hệ khách hàng tại tập đoàn thương mại điện tử toàn cầu.
KINH NGHIỆM LÀM VIỆC
Trưởng phòng quan hệ khách hàng
MW Technology Agency | 01/2021 - Nay
- Phát triển hệ thống phản hồi dịch vụ khách hàng, nâng tỉ lệ phản hồi tích cực lên 96%.
Quản lý phòng Quan hệ khách hàng
SVT Mall | 04/2018 - 12/2020
- Tối ưu quy trình tiếp nhận khách hàng mới giúp giảm thời gian 50%.
HỌC VẤN 10/2014 - 06/2018 Trường Đại học TopCV
© topcv.vn
1 of 1 --
`;

    const result = parser.parse(text);
    expect(result.objective).toContain('trưởng phòng quan hệ khách hàng');
    expect(result.experience).toHaveLength(2);
    expect(result.experience?.[0]).toMatchObject({
      position: 'Trưởng phòng quan hệ khách hàng',
      company: 'MW Technology Agency',
      duration: '01/2021 - Nay',
    });
    expect(result.experience?.[0]?.description).toContain('96%');
    expect(result.experience?.[1]).toMatchObject({
      position: 'Quản lý phòng Quan hệ khách hàng',
      company: 'SVT Mall',
      duration: '04/2018 - 12/2020',
    });
    expect(result.education).toEqual(
      expect.arrayContaining([{ institution: 'Trường Đại học TopCV' }]),
    );
  });

  it('populates experience from dense OCR text with long descriptions', () => {
    const text = `
Tri Anh Chuyên viên quan hệ khách hàng Ngày sinh: 24/08/1996 Giới tính: Nữ
MỤC TIÊU NGHỀ NGHIỆP Chuyên viên quan hệ khách hàng với 03 năm kinh nghiệm trong lĩnh vực thương mại điện tử và 04 năm kinh nghiệm trong lĩnh vực công nghệ.
Kinh nghiệm làm việc
01/2021 - Nay Trưởng phòng quan hệ khách hàng
MW Technology Agency
- Phát triển và cải tiến phần mềm phản hồi dịch vụ khách hàng, góp phần tăng tỉ lệ phản hồi tích cực Đưa ra ý tưởng và trực tiếp tham gia triển khai hệ thống ghi nhận và giải quyết khiếu nại của khách hàng.
04/2018 - 12/2020 Quản lý phòng Quan hệ khách hàng
SVT Mall
- Tối ưu quy trình tiếp nhận khách hàng mới giúp giảm thời gian tiếp nhận lên tới 50% và tăng 46% tỷ lệ hài lòng của khách hàng khi trải nghiệm dịch vụ.
HỌC VẤN 10/2014 - 06/2018 Trường Đại học TopCV
1 of 1 --
`;

    const result = parser.parse(text);
    expect(result.objective).toContain('Chuyên viên quan hệ khách hàng với 03 năm kinh nghiệm');
    expect(result.experience).toHaveLength(2);
    expect(result.experience?.[0]).toMatchObject({
      position: 'Trưởng phòng quan hệ khách hàng',
      company: 'MW Technology Agency',
      duration: '01/2021 - Nay',
    });
    expect(result.experience?.[0]?.description).toContain('Phát triển và cải tiến phần mềm phản hồi dịch vụ');
    expect(result.experience?.[1]).toMatchObject({
      position: 'Quản lý phòng Quan hệ khách hàng',
      company: 'SVT Mall',
      duration: '04/2018 - 12/2020',
    });
    expect(result.experience?.[1]?.description).toContain('Tối ưu quy trình tiếp nhận khách hàng');
  });
});
