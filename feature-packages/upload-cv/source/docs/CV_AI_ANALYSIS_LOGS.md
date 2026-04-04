# CV AI Analysis - Log Events Guide

## Tổng quan
Khi AI phân tích CV, hệ thống sẽ ghi log chi tiết từng bước trong terminal của `job-service`.

## Các Log Events

### 1. Bắt đầu xử lý CV
```
event: 'cv_processing_job_started'
cvId: <uuid>
candidateId: <uuid>
jobId: <job-id>
fileName: <tên-file.pdf>
```

### 2. Bắt đầu phân tích AI
```
event: 'cv_processing_ai_analysis_started'
cvId: <uuid>
candidateId: <uuid>
```

### 3. Gemini - Bắt đầu phân tích
```
event: 'gemini_cv_analysis_started'
candidateId: <uuid>
fileName: <tên-file.pdf>
requestId: <job-id>
```

### 4. Gemini - Upload file
```
event: 'gemini_cv_upload_started'
candidateId: <uuid>
fileSize: <bytes>
```

```
event: 'gemini_cv_upload_completed'
candidateId: <uuid>
fileId: <gemini-file-id>
```

### 5. Gemini - Tạo nội dung (AI analysis)
```
event: 'gemini_cv_content_generation_started'
candidateId: <uuid>
```

### 6. Gemini - Hoàn thành phân tích
```
event: 'gemini_cv_analysis_completed'
candidateId: <uuid>
requestId: <job-id>
hasAiFeedback: true/false
skillsCount: <số-lượng-kỹ-năng>
educationCount: <số-lượng-học-vấn>
experienceCount: <số-lượng-kinh-nghiệm>
```

### 7. Gemini - Dọn dẹp file
```
event: 'gemini_cv_cleanup_started'
candidateId: <uuid>
```

### 8. Cập nhật database
```
event: 'cv_processing_updating_database'
cvId: <uuid>
candidateId: <uuid>
```

### 9. Hoàn thành thành công
```
event: 'cv_processing_success'
cvId: <uuid>
candidateId: <uuid>
durationSeconds: <thời-gian-xử-lý>
```

```
event: 'cv_processing_completed'
cvId: <uuid>
candidateId: <uuid>
```

## Lỗi có thể xảy ra

### Lỗi upload Gemini
```
event: 'gemini_upload_parse_failed'
fileName: <tên-file>
responseSnippet: <đoạn-response>
```

```
event: 'gemini_upload_missing_file_id'
fileName: <tên-file>
responseSnippet: <đoạn-response>
```

### Lỗi phân tích
```
event: 'gemini_cv_analysis_parse_failed'
rawText: <đoạn-text-lỗi>
```

### Lỗi xử lý
```
event: 'cv_processing_error'
cvId: <uuid>
candidateId: <uuid>
durationSeconds: <thời-gian>
error: <thông-báo-lỗi>
```

```
event: 'cv_processing_failed'
cvId: <uuid>
candidateId: <uuid>
error: <thông-báo-lỗi>
```

## Cách xem log

### 1. Trong terminal job-service
Khi chạy `npm run dev` hoặc `npm start`, log sẽ hiển thị trực tiếp:

```bash
cd services/job-service
npm run dev
```

### 2. Grep log theo event
```bash
# Xem tất cả log CV processing
grep "cv_processing" logs/job-service.log

# Xem log Gemini
grep "gemini" logs/job-service.log

# Xem log của một candidate cụ thể
grep "candidateId.*<uuid>" logs/job-service.log
```

### 3. Theo dõi real-time
```bash
# Theo dõi log real-time
tail -f logs/job-service.log | grep "cv_processing\|gemini"
```

## Timeline ví dụ

Một CV được phân tích thành công sẽ có timeline như sau:

```
[14:30:00] cv_processing_job_started
[14:30:00] cv_processing_ai_analysis_started
[14:30:00] gemini_cv_analysis_started
[14:30:01] gemini_cv_upload_started
[14:30:02] gemini_cv_upload_completed
[14:30:02] gemini_cv_content_generation_started
[14:30:15] gemini_cv_analysis_completed (hasAiFeedback: true, skillsCount: 8)
[14:30:15] gemini_cv_cleanup_started
[14:30:15] cv_processing_updating_database
[14:30:15] cv_processing_success (durationSeconds: 15.23)
[14:30:15] cv_processing_completed
```

**Thời gian trung bình:** 10-20 giây tùy độ phức tạp của CV

## Metrics

Hệ thống cũng ghi metrics:
- `cv_parse_duration_seconds`: Thời gian xử lý CV
- `cv_parse_result_total`: Số lượng CV xử lý (success/error)

## Troubleshooting

### CV bị stuck ở PARSING
1. Kiểm tra log có event `cv_processing_job_started` không
2. Kiểm tra có lỗi Gemini API không
3. Kiểm tra Redis queue có hoạt động không

### CV failed
1. Tìm event `cv_processing_error` để xem lỗi
2. Kiểm tra Gemini API key còn hạn không
3. Kiểm tra file PDF có hợp lệ không

### Không thấy log
1. Kiểm tra job-service có đang chạy không
2. Kiểm tra worker có được khởi tạo không (log: `CV processing worker initialised`)
3. Kiểm tra Redis connection
