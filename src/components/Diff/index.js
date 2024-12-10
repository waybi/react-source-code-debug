import React, { useState } from "react";

// function Diff() {
//   const [show, setShow] = useState(true);

//   return (
//     <div>
//       <h1>Reconcile Single Element Demo</h1>
//       {show ? (
//         <p>I'm a single element!</p>
//       ) : (
//         <span>Now I'm changed to a span!</span>
//       )}
//       <button onClick={() => setShow(!show)}>Toggle Element</button>
//     </div>
//   );
// }
// export default Diff;
function DiffAdd() {
  const [items, setItems] = useState(["A"]);

  return (
    <div>
      <h1>Reconcile Children Demo - Add Element</h1>
      <ul>
        {items.map((item, index) => (
          <li key={item}>Item {index}</li>
        ))}
      </ul>
      <button onClick={() => setItems([...items, "B"])}>Add Item</button>
    </div>
  );
}

function DiffDelete() {
  const [items, setItems] = useState(["A", "B", "C"]);

  return (
    <div>
      <h1>Reconcile Children Demo - Remove Element</h1>
      <ul>
        {items.map((item) => (
          <li key={item}>Item {item}</li>
        ))}
      </ul>
      <button onClick={() => setItems(items.filter((item) => item !== "B"))}>
        Remove Item B
      </button>
    </div>
  );
}

function DiffChange() {
  const [items, setItems] = useState(["A", "B", "C"]);

  return (
    <div>
      <h1>Reconcile Children Demo - Move Elements</h1>
      <ul>
        {items.map((item) => (
          <li key={item}>Item {item}</li>
        ))}
      </ul>
      <button onClick={() => setItems(["C", "B", "A"])}>Reverse Order</button>
    </div>
  );
}

function DiffNoKey() {
  const [items, setItems] = useState(["A", "B", "C"]);

  return (
    <div>
      <h1>Reconcile Children Demo - No Keys</h1>
      <ul>
        {items.map((item) => (
          <li>Item {item}</li>
        ))}
      </ul>
      <button onClick={() => setItems(["B", "C", "D"])}>Modify Items</button>
    </div>
  );
}

function DiffHunHe() {
  const [items, setItems] = useState(["A", "B", "C", "D"]);

  return (
    <div>
      <h1>Reconcile Children Demo - Insert and Delete</h1>
      <ul>
        {items.map((item) => (
          <li key={item}>Item {item}</li>
        ))}
      </ul>
      <button onClick={() => setItems(["B", "E", "C"])}>Modify Items</button>
    </div>
  );
}

export { DiffDelete as Diff };
