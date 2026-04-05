FROM node:22-bullseye

WORKDIR /app

# Cài đặt dependencies ngay tại đây
COPY package*.json ./
RUN npm install

# Sau đó mới nạp mã nguồn và cấu hình Vite
COPY . .

# Buộc phải expose đúng cổng 5173
EXPOSE 5173

# Không bao giờ tự động mở trình duyệt bên trong container
ENV VITE_OPEN=false

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
