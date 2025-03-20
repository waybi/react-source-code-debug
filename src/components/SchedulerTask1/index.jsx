import React, { useState, useTransition } from "react";

export default function SchedulerTask1() {
  const [items, setItems] = useState([]);
  const [isPending, startTransition] = useTransition();

  const renderBlocking = () => {
    // 阻塞式渲染（仅用于对比）
    const newItems = Array(50000)
      .fill()
      .map((_, i) => `Item ${i}`);
    setItems(newItems);
  };

  const renderChunked = () => {
    // 并发模式下的时间切片渲染
    startTransition(() => {
      const newItems = Array(49999)
        .fill()
        .map((_, i) => `Item ${i}`);
      setItems(newItems);
    });
  };

  const handleClick = () => {
    renderBlocking();
    renderChunked();
  };

  return (
    <div>
      <button onClick={renderBlocking}>阻塞渲染</button>
      <button onClick={renderChunked}>分片渲染</button>
      <button onClick={handleClick}>同时触发</button>
      <button onClick={() => alert("交互测试")}>测试交互</button>

      {isPending ? "渲染中..." : null}
      <div>
        {items.map((item) => (
          <div key={item}>{item}</div>
        ))}
      </div>
    </div>
  );
}
