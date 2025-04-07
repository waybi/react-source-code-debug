import React, { useState } from "react";
import State from "./components/State";
import LanesDemo from "./components/LanesDemo";
import AppSibling from "./components/AppSibling";
import TasksWithDifferentPriorities from "./components/TasksWithDifferentPriorities";
import SchedulerTask from "./components/SchedulerTask";
import SchedulerTask1 from "./components/SchedulerTask1";
import Concurrent from "./components/ConcurrentInput";
import { Diff } from "./components/Diff";
import PropsDiff from "./components/PropsDiff";
import Hooks from "./components/Hooks";
import EventDemo from "./components/EventDemo";
import ContextDemo from "./components/Context";
import UpdateQueueDemo from "./components/UpdateQueue/UpdateQueue";

import "./App.css";

// propsDiff
/*class App extends React.Component {
  render() {
    return <PropsDiff/>
  }
}*/
function App() {
  // return <State />;

  // 事件系统
  // return <EventDemo/>

  // return <Hooks/>
  // fiber树
  // return (
  //   <div className="App">
  //     <span className={'app-span'} onClick={() => setCount(count + 1)}>App{count}</span>
  //     <AppSibling count={count}/>
  //   </div>
  // );

  // Scheduler调度任务与用户交互
  // return <SchedulerTask />;
  return <SchedulerTask1 />;

  // updateQueue
  // return <UpdateQueueDemo/>

  // 高优先级插队
  // return <TasksWithDifferentPriorities />;

  // context
  // return <ContextDemo/>

  // diff 算法
  // return <Diff />;
}

export default App;
