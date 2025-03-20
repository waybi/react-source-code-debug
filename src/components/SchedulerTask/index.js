import React, { useState, startTransition } from "react";

function TaskSchedulerDemo() {
  const [highPriorityText, setHighPriorityText] = useState("");
  const [lowPriorityProgress, setLowPriorityProgress] = useState(0);
  const [logs, setLogs] = useState([]);

  // 添加日志
  const addLog = (message) => {
    setLogs((prev) => [...prev, `${Date.now()}: ${message}`]);
  };

  // 高优先级任务：用户输入
  const handleInputChange = (e) => {
    const value = e.target.value;
    setHighPriorityText(value); // 同步更新
    addLog("高优先级任务（用户输入）触发");
  };

  // 低优先级任务：模拟耗时计算
  const startLowPriorityTask = () => {
    // addLog("高，低优先级任务开始");
    startTransition(() => {
      const startTime = Date.now();
      const simulateHeavyWork = () => {
        addLog("低优先级任务完成，startTime：：：" + startTime);
        // if (Date.now() - startTime < 3000) {
        //   // 模拟3秒耗时任务
        //   setLowPriorityProgress((prev) => {
        //     const newProgress = prev + 1;
        //     if (newProgress >= 100) return 100;
        //     requestAnimationFrame(simulateHeavyWork); // 继续执行
        //     return newProgress;
        //   });
        // } else {
        //   addLog("低优先级任务完成");
        // }
      };
      simulateHeavyWork();
    });

    const randomInt = Math.floor(Math.random() * 101);
    setHighPriorityText(randomInt); // 同步更新
  };

  return (
    <div>
      <h2>高优先级任务（用户输入）</h2>
      <input
        type="text"
        value={highPriorityText}
        onChange={handleInputChange}
      />
      <hr />
      <h2>同时出发高/低优先级任务</h2>
      <button onClick={startLowPriorityTask}>开始低优先级任务</button>
      <div>进度：{lowPriorityProgress}%</div>
      <hr />
      <h2>调度日志</h2>
      <div
        style={{ height: "200px", overflow: "auto", border: "1px solid #ccc" }}
      >
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default TaskSchedulerDemo;
