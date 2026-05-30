type Props = {
  value: string;
  readOnly?: boolean;
  onChange?: (text: string) => void;
};

export function OnePagerRecommendation({ value, readOnly, onChange }: Props) {
  return (
    <div className="one-pager-recommendation">
      <h4 className="one-pager-subheading">Рекомендация</h4>
      {readOnly ? (
        <p className="one-pager-recommendation__text">{value || '—'}</p>
      ) : (
        <textarea
          className="one-pager-recommendation__textarea"
          rows={4}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
    </div>
  );
}
