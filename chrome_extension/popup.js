document.getElementById('scanBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Đang lấy dữ liệu...";

    try {
        // 1. Lấy tab hiện tại (Shopee/Lazada)
        const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // 2. Chạy script để lấy HTML
        const result = await chrome.scripting.executeScript({
            target: { tabId: sourceTab.id },
            func: () => document.body.outerHTML
        });
        const html = result[0].result;

        // 3. Tìm tab Super Scraper (Web App)
        const tabs = await chrome.tabs.query({});
        // Tìm tab nào có tiêu đề chứa "Super Scraper"
        const appTab = tabs.find(t => t.title && t.title.includes("Super Scraper Pro"));

        if (appTab) {
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
                args: [html, sourceTab.url, sourceTab.title]
            });
            statusEl.innerText = "✅ Đã gửi thành công!";
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