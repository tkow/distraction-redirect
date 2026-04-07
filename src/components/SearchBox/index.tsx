import React, { ChangeEvent, CSSProperties, useCallback, useMemo } from "react";

type SearchBoxProps = {
  style?: CSSProperties;
  value: string;
  onChangeSearchText: (args: string) => void;
};

const searchBoxLayout: CSSProperties = {
  display: "flex",
  width: "100%",
  alignItems: "center",
};

const searchBoxStyle: CSSProperties = {
  minWidth: "90px",
  marginLeft: "6px",
};

export default function SearchBox({
  style,
  value,
  onChangeSearchText,
}: SearchBoxProps) {
  const onChangeText = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    onChangeSearchText(e.target.value);
  }, []);

  const _style = useMemo(() => {
    return {
      ...style,
      ...searchBoxLayout,
    };
  }, [style]);

  return (
    <div style={_style}>
      <div>検索:</div>
      <input
        style={searchBoxStyle}
        type={"search"}
        onChange={onChangeText}
        value={value}
      />
    </div>
  );
}
