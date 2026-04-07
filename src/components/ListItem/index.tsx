import React, { CSSProperties, useCallback, useMemo } from "react";

type ListItemProps = {
  word: string;
  referenceCount: number;
  onRemoveItem: (word: string) => void;
  onHideItem: (word: string) => void;
  hidden?: boolean
};

const listStyles: CSSProperties = {
    justifyContent: 'space-between',
    display: 'flex',
    alignItems: 'center'
}

const shownButtonLayout: CSSProperties = {
    justifyContent: 'space-between',
    display: 'flex',
    width: '105px'
}

const hiddenButtonLayout: CSSProperties = {
    justifyContent: 'space-between',
    display: 'flex',
    width: '90px'
}

export default function ListItem({
  word,
  referenceCount,
  hidden,
  onHideItem,
  onRemoveItem,
}: ListItemProps) {
  const removeItem = useCallback(async () => {
    await chrome.storage.local.remove(word);
    onRemoveItem(word);
  }, [word, onRemoveItem]);

  const changeLearnedItem = useCallback(async () => {
    const value = await chrome.storage.local.get(word);
    await chrome.storage.local.set({
      [word]: {
        ...value[word],
        hidden: !hidden,
      },
    });
    onHideItem(word);
  }, [word, onHideItem, hidden]);

  const toggleButtonLabel = useMemo(()=> hidden ? "表示":"非表示",[hidden])
  const buttonLayout = useMemo(()=> hidden ? hiddenButtonLayout: shownButtonLayout,[hidden])

  return (
    <li style={listStyles}>
      <div>
        {word} 確認回数:{referenceCount}
      </div>
      <div style={buttonLayout}>
        <button value={toggleButtonLabel} onClick={changeLearnedItem}>
          {toggleButtonLabel}
        </button>
        <button value={"削除"} onClick={removeItem}>
          削除
        </button>
      </div>
    </li>
  );
}
