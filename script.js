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
const uploadedCount = document.getElementById('uploadedCount');
const fileCount = document.getElementById('fileCount');
const particlesContainer = document.getElementById('particles');

let selectedFiles = [];
let uploadedFilesCount = 0;

// Tạo particles
function createParticles() {
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: rgba(255, 255, 255, ${Math.random() * 0.5 + 0.2});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: particleFloat ${Math.random() * 10 + 10}s linear infinite;
            animation-delay: ${Math.random() * 5}s;
        `;
        particlesContainer.appendChild(particle);
    }
}

// Thêm CSS cho particles animation
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes particleFloat {
        0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(particleStyle);

createParticles();

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
    fileCount.textContent = selectedFiles.length;
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
                <div class="file-name">${escapeHtml(file.name)}</div>
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
    } else {
        fileCount.textContent = selectedFiles.length;
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
    if (fileType.includes('javascript') || fileType.includes('json')) return 'fas fa-file-code';
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

// Escape HTML để tránh XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Xử lý upload
uploadBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;
    
    uploadBtn.style.display = 'none';
    uploadProgress.style.display = 'block';
    
    // Giả lập quá trình upload với tốc độ thực tế hơn
    for (let i = 0; i <= 100; i++) {
        await sleep(15);
        progressFill.style.width = i + '%';
        progressPercentage.textContent = i + '%';
    }
    
    // Thêm files vào danh sách đã upload
    selectedFiles.forEach(file => {
        addUploadedFile(file);
        uploadedFilesCount++;
    });
    
    uploadedCount.textContent = uploadedFilesCount;
    
    // Reset
    selectedFiles = [];
    filesPreview.innerHTML = '';
    fileInput.value = '';
    
    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        
        // Hiển thị thông báo thành công với confetti
        showNotification('Upload thành công! 🎉', 'success');
        createConfetti();
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
            <div class="file-name">${escapeHtml(file.name)}</div>
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
        top: 30px;
        right: 30px;
        background: ${type === 'success' 
            ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' 
            : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
        color: white;
        padding: 20px 35px;
        border-radius: 20px;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
        z-index: 10000;
        animation: slideInRight 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 700;
        font-size: 16px;
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}" style="font-size: 24px;"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        setTimeout(() => notification.remove(), 500);
    }, 3500);
}

// Tạo confetti effect
function createConfetti() {
    const colors = ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        confetti.style.cssText = `
            position: fixed;
            width: 10px;
            height: 10px;
            background: ${color};
            top: -10px;
            left: ${Math.random() * 100}%;
            opacity: 1;
            z-index: 9999;
            animation: confettiFall ${Math.random() * 3 + 2}s linear forwards;
            transform: rotate(${Math.random() * 360}deg);
        `;
        
        document.body.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
    }
}

// Hàm sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Thêm CSS cho animations
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
    
    @keyframes confettiFall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Thông báo chào mừng
window.addEventListener('load', () => {
    setTimeout(() => {
        showNotification('Chào mừng bạn đến với CloudUpload! ✨', 'success');
    }, 1000);
});
