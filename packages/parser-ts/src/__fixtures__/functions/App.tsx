import { Header } from "./Header";
import { useCounter } from "./useCounter";

export const App = () => {
  const count = useCounter();
  return (
    <div>
      <Header />
      <span>{count}</span>
    </div>
  );
};
