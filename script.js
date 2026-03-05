// Khởi tạo các biến
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const filesPreview = document.getElementById('filesPreview');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressPercentage = document.getElementById('progressPercentage');
const uploadedList = document.getElementById('uploadedList');

let selectedFiles = [];

// Xử lý click vào nút Browse
browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

// Xử lý click vào upload area
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Xử lý khi chọn file
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// Xử lý drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

// Xử lý files
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = [...selectedFiles, ...newFiles];
    displayFiles();
    uploadBtn.style.display = 'block';
}

// Hiển thị danh sách files
function displayFiles() {
    filesPreview.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const icon = getFileIcon(file.type);
        const size = formatFileSize(file.size);
        
        fileItem.innerHTML = `
            <div class="file-icon">
                <i class="${icon}"></i>
            </div>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${size}</div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        filesPreview.appendChild(fileItem);
    });
}

// Xóa file
function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFiles();
    
    if (selectedFiles.length === 0) {
        uploadBtn.style.display = 'none';
    }
}

// Lấy icon theo loại file
function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return 'fas fa-image';
    if (fileType.startsWith('video/')) return 'fas fa-video';
    if (fileType.startsWith('audio/')) return 'fas fa-music';
    if (fileType.includes('pdf')) return 'fas fa-file-pdf';
    if (fileType.includes('word')) return 'fas fa-file-word';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'fas fa-file-powerpoint';
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('compressed')) return 'fas fa-file-archive';
    if (fileType.includes('text')) return 'fas fa-file-alt';
    return 'fas fa-file';
}

// Format kích thước file
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Xử lý upload
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    
    uploadBtn.style.display = 'none';
    uploadProgress.style.display = 'block';
    
    // Giả lập quá trình upload
    for (let i = 0; i <= 100; i++) {
        await sleep(20);
        progressFill.style.width = i + '%';
        progressPercentage.textContent = i + '%';
    }
    
    // Thêm files vào danh sách đã upload
    selectedFiles.forEach(file => {
        addUploadedFile(file);
    });
    
    // Reset
    selectedFiles = [];
    filesPreview.innerHTML = '';
    fileInput.value = '';
    
    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        
        // Hiển thị thông báo thành công
        showNotification('Upload thành công!', 'success');
    }, 500);
});

// Thêm file đã upload
function addUploadedFile(file) {
    // Xóa empty state nếu có
    const emptyState = uploadedList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    const uploadedItem = document.createElement('div');
    uploadedItem.className = 'uploaded-item';
    
    const icon = getFileIcon(file.type);
    const size = formatFileSize(file.size);
    const date = new Date().toLocaleString('vi-VN');
    
    uploadedItem.innerHTML = `
        <div class="file-icon">
            <i class="${icon}"></i>
        </div>
        <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${size}</div>
            <div class="uploaded-date">${date}</div>
        </div>
        <button class="download-btn">
            <i class="fas fa-download"></i>
            Tải xuống
        </button>
    `;
    
    uploadedList.insertBefore(uploadedItem, uploadedList.firstChild);
}

// Hiển thị thông báo
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
        color: white;
        padding: 20px 30px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
        backdrop-filter: blur(10px);
    `;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Hàm sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Thêm CSS cho animation notification
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
