
document.getElementById('scanBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('status');
    statusEl.innerText = "Đang lọc bỏ 'Gợi ý hôm nay' & Quảng cáo...";
    statusEl.style.color = "#d97706"; // Amber color

    try {
        const [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const result = await chrome.scripting.executeScript({
            target: { tabId: sourceTab.id },
            func: () => {
                try {
                    const clone = document.body.cloneNode(true);
                    
                    // 1. XÓA CÁC THẺ RÁC CƠ BẢN
                    const trashSelectors = [
                        'script', 'style', 'svg', 'iframe', 'noscript', 
                        'link', 'meta', 'footer', 'header', 'nav',
                        'div[id*="footer"]', 'div[class*="footer"]',
                        'form', 'input', 'button', 'textarea',
                        '.chat-container', '#chat-container'
                    ];
                    trashSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

                    // 2. TIKTOK SPECIAL CLEANING (QUAN TRỌNG: Video/Live rất nặng)
                    const tiktokTrash = [
                        'video', 'canvas', 
                        '.xgplayer-container', // Video player
                        '[data-e2e="video-container"]', 
                        '[data-e2e="live-room-container"]', // Livestream
                        '.tiktok-video-player'
                    ];
                    tiktokTrash.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));

                    // 3. XÓA PHẦN "GỢI Ý CHO BẠN" / "SẢN PHẨM TƯƠNG TỰ"
                    // Shopee
                    const headers = clone.querySelectorAll('.shopee-header-section__header__title');
                    headers.forEach(h => {
                        const text = h.innerText.toLowerCase();
                        if (text.includes('gợi ý') || text.includes('tương tự') || text.includes('có thể bạn cũng thích') || text.includes('recommend')) {
                            const section = h.closest('.shopee-header-section') || h.closest('.section-recommend') || h.parentNode.parentNode;
                            if (section) section.remove();
                        }
                    });

                    // Lazada
                    const lazRec = clone.querySelector('[data-spm="recommendation"]');
                    if (lazRec) lazRec.remove();

                    // Tiki
                    const tikiRec = clone.querySelectorAll('div[data-view-id="product_list_container"]');
                    if (tikiRec.length > 1) {
                         for(let i=1; i<tikiRec.length; i++) tikiRec[i].remove();
                    }

                    // 4. Clean Comment Nodes
                    const cleanComments = (node) => {
                        for (let i = 0; i < node.childNodes.length; i++) {
                            const child = node.childNodes[i];
                            if (child.nodeType === 8) { 
                                node.removeChild(child);
                                i--;
                            } else if (child.nodeType === 1) {
                                cleanComments(child);
                            }
                        }
                    };
                    cleanComments(clone);

                    return clone.innerHTML;
                } catch (e) {
                    return document.body.outerHTML; 
                }
            }
        });
        
        const cleanHtml = result[0].result;
        console.log("Cleaned HTML size:", cleanHtml.length);

        const tabs = await chrome.tabs.query({});
        const appTab = tabs.find(t => t.title && t.title.includes("Super Scraper Pro"));

        if (appTab) {
            statusEl.innerText = "Đang gửi dữ liệu sạch...";
            await chrome.scripting.executeScript({
                target: { tabId: appTab.id },
                func: (data, url, title) => {
                    window.postMessage({
                        type: 'SUPER_SCRAPER_EXTENSION_DATA',
                        payload: { html: data, url: url, title: title }
                    }, '*');
                },
                args: [cleanHtml, sourceTab.url, sourceTab.title]
            });
            statusEl.innerText = "✅ Đã gửi xong! (Chỉ lấy SP chính)";
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
