import React, { useState, useEffect, useRef, startTransition } from "react";
import "./styles.css";

function UpdateQueueDemo() {
  const [count, setCount] = useState(0);
  const [batchedCount, setBatchedCount] = useState(0);
  const [priorityText, setPriorityText] = useState("");
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const timeoutRef = useRef(null);

  // 添加日志
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    setLogs((prev) => [...prev, `${timestamp}: ${message}`]);
  };

  // 清除日志
  const clearLogs = () => {
    setLogs([]);
  };

  // 模拟耗时操作
  const simulateHeavyWork = (duration = 500) => {
    const start = Date.now();
    while (Date.now() - start < duration) {
      // 执行空循环，模拟 CPU 密集型操作
    }
  };

  // 场景1: 单次更新
  const handleSingleUpdate = () => {
    // addLog("执行单次更新");
    setCount(count + 1);
    // addLog(`更新后的值应为 ${count + 1}`);
  };

  // 场景2: 多次更新但不批处理
  const handleMultipleUpdates = () => {
    // addLog("执行多次独立更新 (无批处理)");

    // 每次更新都会触发重新渲染
    setCount((c) => {
      // addLog(`更新1: ${c} -> ${c + 1}`);
      return c + 1;
    });

    setTimeout(() => {
      setCount((c) => {
        // addLog(`更新2: ${c} -> ${c + 1}`);
        return c + 1;
      });
    }, 0);

    setTimeout(() => {
      setCount((c) => {
        // addLog(`更新3: ${c} -> ${c + 1}`);
        return c + 1;
      });
    }, 0);
  };

  // 场景3: 批量更新
  const handleBatchedUpdates = () => {
    // addLog("执行批量更新 (React 自动批处理)");

    // 在一个事件处理函数中的多次更新会被批处理
    setBatchedCount((c) => {
      // addLog(`批量更新1: ${c} -> ${c + 1}`);
      return c + 1;
    });

    setBatchedCount((c) => {
      // addLog(`批量更新2: ${c} -> ${c + 2}`);
      return c + 2;
    });

    setBatchedCount((c) => {
      // addLog(`批量更新3: ${c} -> ${c + 3}`);
      return c + 3;
    });

    // 最终只会触发一次重新渲染，值为 c + 6
    // addLog(`批量更新后的预期值: ${batchedCount + 6}`);
  };

  // 场景4: 优先级更新
  const handlePriorityUpdate = () => {
    addLog("触发高优先级和低优先级更新");
    setIsProcessing(true);

    // 高优先级更新 - 用户输入
    setPriorityText("高优先级更新");
    addLog("高优先级更新已触发");

    // 低优先级更新 - 使用 startTransition
    startTransition(() => {
      addLog("开始低优先级更新 (startTransition)");

      // 模拟耗时计算
      simulateHeavyWork(2000);

      setPriorityText((prev) => {
        const newValue = `${prev} + 低优先级更新完成`;
        addLog(`低优先级更新完成: "${newValue}"`);
        return newValue;
      });
    });

    // 设置一个定时器，在处理过程中触发另一个高优先级更新
    timeoutRef.current = setTimeout(() => {
      addLog("处理过程中触发新的高优先级更新");
      setPriorityText((prev) => {
        const interruptValue = prev.includes("低优先级")
          ? prev
          : `${prev} (被高优先级中断)`;
        return interruptValue;
      });
      setIsProcessing(false);
    }, 1000);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="update-queue-demo">
      <h1>React UpdateQueue 演示</h1>

      <div className="demo-section">
        <h2>1. 单次状态更新</h2>
        <p>
          当前值: <span className="value">{count}</span>
        </p>
        <button onClick={handleSingleUpdate}>执行单次更新</button>
      </div>

      <div className="demo-section">
        <h2>2. 多次独立更新 (无批处理)</h2>
        <p>
          当前值: <span className="value">{count}</span>
        </p>
        <button onClick={handleMultipleUpdates}>执行多次独立更新</button>
        <p className="note">注意: 这些更新在不同的事件循环中，不会被批处理</p>
      </div>

      <div className="demo-section">
        <h2>3. 批量更新演示</h2>
        <p>
          当前值: <span className="value">{batchedCount}</span>
        </p>
        <button onClick={handleBatchedUpdates}>执行批量更新</button>
        <p className="note">
          注意: 同一事件处理函数中的多次更新会被合并为一次渲染
        </p>
      </div>

      <div className="demo-section">
        <h2>4. 优先级更新演示</h2>
        <p>
          当前文本: <span className="value">{priorityText}</span>
        </p>
        <button onClick={handlePriorityUpdate} disabled={isProcessing}>
          {isProcessing ? "处理中..." : "触发优先级更新"}
        </button>
        <p className="note">注意: 高优先级更新会中断低优先级更新</p>
      </div>

      <div className="logs-section">
        <div className="logs-header">
          <h2>更新日志</h2>
          <button onClick={clearLogs} className="clear-btn">
            清除日志
          </button>
        </div>
        <div className="logs">
          {logs.map((log, index) => (
            <div key={index} className="log-entry">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UpdateQueueDemo;
