
document.getElementById('scanBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Đang xử lý & làm sạch HTML...";
    statusEl.style.color = "#d97706"; // Amber color

    try {
        // 1. Lấy tab hiện tại (Shopee/Lazada)
        const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 2. Chạy script để lấy HTML ĐÃ LÀM SẠCH (Clean HTML)
        const result = await chrome.scripting.executeScript({
            target: { tabId: sourceTab.id },
            func: () => {
                // --- HÀM LÀM SẠCH HTML TẠI NGUỒN ---
                // Giúp giảm dung lượng từ 5-10MB xuống còn <500KB
                try {
                    // Clone body để không ảnh hưởng trang gốc
                    const clone = document.body.cloneNode(true);
                    
                    // Xóa các thẻ rác không chứa dữ liệu sản phẩm
                    const trashSelectors = [
                        'script', 'style', 'svg', 'iframe', 'noscript', 
                        'link', 'meta', 'footer', 'header', 
                        'div[id*="footer"]', 'div[class*="footer"]',
                        'form', 'input', 'button', 'textarea'
                    ];
                    
                    trashSelectors.forEach(sel => {
                        const els = clone.querySelectorAll(sel);
                        els.forEach(el => el.remove());
                    });

                    // Xóa Comment <!-- -->
                    const cleanComments = (node) => {
                        for (let i = 0; i < node.childNodes.length; i++) {
                            const child = node.childNodes[i];
                            if (child.nodeType === 8) { // 8 là Comment Node
                                node.removeChild(child);
                                i--;
                            } else if (child.nodeType === 1) {
                                cleanComments(child);
                            }
                        }
                    };
                    cleanComments(clone);

                    // Trả về HTML gọn nhẹ
                    return clone.innerHTML;
                } catch (e) {
                    return document.body.outerHTML; // Fallback nếu lỗi
                }
            }
        });
        
        const cleanHtml = result[0].result;
        console.log("Original HTML size optimized to:", cleanHtml.length);

        // 3. Tìm tab Super Scraper (Web App)
        const tabs = await chrome.tabs.query({});
        // Tìm tab nào có tiêu đề chứa "Super Scraper"
        const appTab = tabs.find(t => t.title && t.title.includes("Super Scraper Pro"));

        if (appTab) {
            statusEl.innerText = "Đang gửi dữ liệu...";
            // 4. Bắn dữ liệu sang tab đó
            await chrome.scripting.executeScript({
                target: { tabId: appTab.id },
                func: (data, url, title) => {
                    // Gửi tin nhắn window.postMessage để App React bắt được
                    window.postMessage({
                        type: 'SUPER_SCRAPER_EXTENSION_DATA',
                        payload: { html: data, url: url, title: title }
                    }, '*');
                },
                args: [cleanHtml, sourceTab.url, sourceTab.title]
            });
            statusEl.innerText = "✅ Đã gửi xong! (Đã tối ưu)";
            statusEl.style.color = "green";
        } else {
            statusEl.innerText = "❌ Không tìm thấy tab Super Scraper!";
            statusEl.style.color = "red";
        }
    } catch (err) {
        statusEl.innerText = "Lỗi: " + err.message;
        statusEl.style.color = "red";
    }
});
