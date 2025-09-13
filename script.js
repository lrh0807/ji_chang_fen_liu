document.addEventListener('DOMContentLoaded', function () {
    const inputYAML = document.getElementById('inputYAML');
    const nodeList = document.getElementById('nodeList');
    const nodeCount = document.getElementById('nodeCount');
    const selectedCount = document.getElementById('selectedCount');
    const restoreButton = document.getElementById('restoreButton');
    let selectedNodes = new Set();
    let originalConfig = null; // 存储原始配置

    inputYAML.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputYAML.style.borderColor = '#3b82f6';
    });

    inputYAML.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputYAML.style.borderColor = '#e5e7eb';
    });

    inputYAML.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputYAML.style.borderColor = '#e5e7eb';
        const files = Array.from(e.dataTransfer.files);
        let allProxies = [];

        try {
            for (const file of files) {
                const content = await readFileAsync(file);
                const yamlData = jsyaml.load(content);

                if (yamlData.proxies && Array.isArray(yamlData.proxies)) {
                    allProxies = allProxies.concat(yamlData.proxies);
                }
            }

            const combinedConfig = {
                proxies: allProxies
            };

            originalConfig = JSON.parse(JSON.stringify(combinedConfig)); // 保存原始配置的深拷贝
            inputYAML.value = jsyaml.dump(combinedConfig);
            document.getElementById('infoDiv').textContent = `成功合并 ${allProxies.length} 个节点`;
            selectedNodes.clear();
            updateNodeList(allProxies);
            restoreButton.style.display = 'none';
        } catch (error) {
            console.error('Error processing files:', error);
            document.getElementById('infoDiv').textContent = '处理文件时发生错误，请确认所有文件格式正确！';
        }
    });

    restoreButton.addEventListener('click', function () {
        if (originalConfig) {
            inputYAML.value = jsyaml.dump(originalConfig);
            document.getElementById('infoDiv').textContent = `已还原为原始配置（${originalConfig.proxies.length} 个节点）`;
            selectedNodes.clear();
            updateNodeList(originalConfig.proxies);
            restoreButton.style.display = 'none';
        }
    });

    function readFileAsync(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }

    function updateSelectedCount() {
        if (selectedNodes.size > 0) {
            selectedCount.textContent = `已选择 ${selectedNodes.size} 个节点`;
        } else {
            selectedCount.textContent = '';
        }
    }

    function updateNodeList(proxies) {
        const startPort = parseInt(document.getElementById('startPort').value);
        nodeList.innerHTML = '';
        nodeCount.textContent = `共 ${proxies.length} 个节点`;
        updateSelectedCount();

        proxies.forEach((proxy, index) => {
            const nodeItem = document.createElement('div');
            nodeItem.className = 'node-item';
            if (selectedNodes.has(index)) {
                nodeItem.classList.add('selected');
            }

            nodeItem.innerHTML = `
                <span class="node-region">${proxy.name}</span>
                <span class="node-proxy">127.0.0.1:${startPort + index}</span>
            `;

            nodeItem.addEventListener('click', () => {
                if (selectedNodes.has(index)) {
                    selectedNodes.delete(index);
                    nodeItem.classList.remove('selected');
                } else {
                    selectedNodes.add(index);
                    nodeItem.classList.add('selected');
                }
                updateSelectedCount();
            });

            nodeList.appendChild(nodeItem);
        });
    }

    document.getElementById('processButton').addEventListener('click', function () {
        const startPort = parseInt(document.getElementById('startPort').value);
        const infoDiv = document.getElementById('infoDiv');
        const outputDiv = document.getElementById('outputDiv');

        try {
            const yamlData = jsyaml.load(inputYAML.value);
            if (!yamlData.proxies || !Array.isArray(yamlData.proxies)) {
                infoDiv.textContent = '无效的配置格式！';
                return;
            }

            yamlData.proxies = yamlData.proxies.filter((_, index) => !selectedNodes.has(index));
            const numProxies = yamlData.proxies.length;

            yamlData.proxies.forEach((proxy, i) => {
                const port = startPort + i;
                proxy.name = `${port} | ${proxy.name}`;
            });

            const newYAML = {
                'allow-lan': true,
                dns: {
                    enable: true,
                    'enhanced-mode': 'fake-ip',
                    'fake-ip-range': '198.18.0.1/16',
                    'default-nameserver': ['114.114.114.114'],
                    nameserver: ['https://doh.pub/dns-query']
                },
                listeners: [],
                proxies: yamlData.proxies
            };

            newYAML.listeners = Array.from({ length: numProxies }, (_, i) => ({
                name: `mixed${i}`,
                type: 'mixed',
                port: startPort + i,
                proxy: yamlData.proxies[i].name
            }));

            const newYAMLString = jsyaml.dump(newYAML);
            document.getElementById('outputYAML').value = newYAMLString;

            const blob = new Blob([newYAMLString], { type: 'text/yaml' });
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(blob);
            downloadLink.download = 'merged_socks.yaml';
            downloadLink.className = 'download-link';
            downloadLink.textContent = '下载配置文件';

            outputDiv.innerHTML = '';
            outputDiv.appendChild(downloadLink);

            infoDiv.textContent = `已删除 ${selectedNodes.size} 个节点，剩余 ${numProxies} 个节点`;
            selectedNodes.clear();
            updateNodeList(yamlData.proxies);
            restoreButton.style.display = 'inline-block';
        } catch (error) {
            infoDiv.textContent = '发生错误，请确认配置格式正确后重试！';
            console.error(error);
        }
    });
});
