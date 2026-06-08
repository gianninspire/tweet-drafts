const MAX = 280;

export default function CharCounter({ count }: { count: number }) {
  const remaining = MAX - count;
  const over = remaining < 0;
  const near = remaining <= 20 && remaining >= 0;

  return (
    <span
      className={`text-xs tabular-nums ${
        over ? "text-red-400" : near ? "text-amber-400" : "text-neutral-500"
      }`}
    >
      {count}/{MAX}
    </span>
  );
}

export { MAX };
