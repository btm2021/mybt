# Hướng dẫn cấu hình Firebase cho ứng dụng Backtest (Đơn giản)

## Bước 1: Tạo Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Nhấn "Create a project" hoặc "Add project"
3. Nhập tên project (ví dụ: "manual-backtest-app")
4. Tắt Google Analytics nếu không cần thiết
5. Nhấn "Create project"

## Bước 2: Thiết lập Firestore Database

1. Trong Firebase Console, chọn "Firestore Database" từ menu bên trái
2. Nhấn "Create database"
3. **Chọn "Start in test mode"** (quan trọng - để không cần authentication)
4. Chọn location gần nhất (ví dụ: asia-southeast1)
5. Nhấn "Done"

## Bước 3: Lấy Firebase Configuration

1. Nhấn vào biểu tượng "Settings" (bánh răng) > "Project settings"
2. Cuộn xuống phần "Your apps"
3. Nhấn biểu tượng "</>" để thêm web app
4. Nhập tên app (ví dụ: "Backtest Web App")
5. Không cần check "Firebase Hosting"
6. Nhấn "Register app"
7. Copy đoạn config code

## Bước 4: Cập nhật Firebase Config (Đã hoàn thành)

Firebase config đã được cấu hình sẵn trong `js/firebase-config.js`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCbk9ZoE0oFA62P7ZkIGwT8gHWONrj54-w",
  authDomain: "mybt-10ac9.firebaseapp.com",
  projectId: "mybt-10ac9",
  storageBucket: "mybt-10ac9.firebasestorage.app",
  messagingSenderId: "14394910549",
  appId: "1:14394910549:web:359fc21c0bf457833031dc"
};
```

## Bước 5: Cấu hình Firestore Security Rules (Đã thiết lập)

Vì đây là ứng dụng nội bộ, Firestore đã được cấu hình ở "test mode" cho phép đọc/ghi tự do. 

**Lưu ý**: Test mode sẽ tự động hết hạn sau 30 ngày. Nếu cần sử dụng lâu dài, cập nhật rules thành:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cho phép đọc/ghi tự do (chỉ dành cho ứng dụng nội bộ)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Cấu trúc dữ liệu trong Firestore

Ứng dụng sẽ tạo cấu trúc dữ liệu đơn giản như sau:

```
users/
  internal-user/  // Fixed user ID cho ứng dụng nội bộ
    settings: {
      selectedSymbolId: string,
      activeView: string,
      activeStrategy: string
    }
    symbols/
      {symbolId}: {
        id: string,
        name: string,
        exchange: string,
        timeframe: string,
        indicators: array,
        comment: string,
        baseCapital: number, // Vốn riêng cho symbol này (1000 USDT mặc định)
        createdAt: timestamp,
        updatedAt: timestamp
      }
    trades/
      {tradeId}: {
        id: string,
        symbolId: string,
        result: string, // 'win' hoặc 'loss'
        mode: string, // 'single', 'multi', 'combi'
        indicator: string,
        combo: string,
        notes: string,
        roe: number,
        isBigWin: boolean,
        timestamp: string,
        updatedAt: timestamp
      }
```

## Lưu ý quan trọng

1. **Vốn theo Symbol**: Mỗi symbol có `baseCapital` riêng (mặc định 1000 USDT), không phải tổng tài sản
2. **Offline Support**: Ứng dụng hỗ trợ làm việc offline, dữ liệu sẽ sync khi có internet
3. **Không cần Authentication**: Ứng dụng sử dụng fixed user ID cho đơn giản
4. **Real-time Updates**: Dữ liệu sẽ được lưu ngay lập tức lên Firebase
5. **Ứng dụng nội bộ**: Không có bảo mật phức tạp, phù hợp cho sử dụng nội bộ

## Troubleshooting

- Nếu gặp lỗi CORS, đảm bảo domain của bạn được thêm vào Firebase Console
- Nếu không thể ghi dữ liệu, kiểm tra Firestore Rules (đảm bảo đang ở test mode)
- Nếu loading lâu, kiểm tra kết nối internet và Firebase config
- Nếu test mode hết hạn, cập nhật Firestore Rules như hướng dẫn ở Bước 5