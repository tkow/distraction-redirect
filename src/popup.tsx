import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  CSSProperties,
} from "react";
import { createRoot } from "react-dom/client";
import { Item } from "./types";
import ListItem from "./components/ListItem";
import SearchBox from "./components/SearchBox";

const radioButtonStyle: CSSProperties = {
  display: "flex",
  margin: "0px 10px",
};

const radioButtonInputStyle: CSSProperties = {
  margin: "0px 2px",
};

const radioButtonInputLayoutStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "0px 2px",
};

const radioButtonAreaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const searchBoxStyle: CSSProperties = {
  margin: "8px 14px 0px",
};

const listStyle: CSSProperties = {
  maxHeight: '86vh',
  overflowY: 'scroll',
  width: "400px"
}

const Popup = () => {
  const [vocabularies, setVocabularies] = useState<Record<string, Item>>({});
  const [display, setDisplay] = useState<"show" | "hidden">("show");
  const [order, setOrder] = useState<"count-desc" | "count-asc">("count-desc");
  const [searchText, setSearchText] = useState<string>("");

  useEffect(() => {
    const listener = async function (
      request: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) {
      if (request.event === "updateStorage") {
        await chrome.storage.local.get().then((values) => {
          setVocabularies(values);
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    chrome.storage.local.get().then((values) => {
      setVocabularies(values);
    });
    return () => {
      setVocabularies({});
    };
  }, []);

  const list = useMemo(() => {
    return Object.entries(vocabularies)
      .map(([word, detail]) => {
        return {
          word,
          referenceCount: detail.referenceCount,
          hidden: detail.hidden,
        };
      })
      .filter((value) => {
        return value.word.includes(searchText) && display === "show" ? !value.hidden : value.hidden;
      })
      .sort((a, b) => {
        if (order === "count-asc") return a.referenceCount - b.referenceCount;
        return b.referenceCount - a.referenceCount;
      });
  }, [vocabularies, display, order, searchText]);

  const onRemoveEvent = useCallback(async (_word: string) => {
    const values = await chrome.storage.local.get();
    setVocabularies(values);
  }, []);

  return (
    <div>
      <div style={radioButtonAreaStyle}>
        <div style={radioButtonStyle}>
          <div style={radioButtonInputLayoutStyle}>
            <input
              style={radioButtonInputStyle}
              type="radio"
              id="show"
              name="display"
              value="show"
              onChange={() => {
                setDisplay("show");
              }}
              checked={display === "show"}
            />
            <label htmlFor="show">単語リスト</label>
          </div>
          <div style={radioButtonInputLayoutStyle}>
            <input
              style={radioButtonInputStyle}
              type="radio"
              id="hidden"
              name="display"
              value="hidden"
              onChange={() => {
                setDisplay("hidden");
              }}
              checked={display === "hidden"}
            />
            <label htmlFor="hidden">非表示</label>
          </div>
        </div>
        <div style={radioButtonStyle}>
          <div style={radioButtonInputLayoutStyle}>
            <input
              style={radioButtonInputStyle}
              type="radio"
              id="count-desc"
              name="count_order"
              value="count-desc"
              onChange={() => {
                setOrder("count-desc");
              }}
              checked={order === "count-desc"}
            />
            <label htmlFor="count-desc">確認回数:降順</label>
          </div>
          <div style={radioButtonInputLayoutStyle}>
            <input
              style={radioButtonInputStyle}
              type="radio"
              id="count-asc"
              name="count_order"
              value="count-asc"
              onChange={() => {
                setOrder("count-asc");
              }}
              checked={order === "count-asc"}
            />
            <label htmlFor="count-asc">確認回数:昇順</label>
          </div>
        </div>
      </div>
      <SearchBox
        style={searchBoxStyle}
        value={searchText}
        onChangeSearchText={setSearchText}
      />
      {list.length === 0 && !searchText && (
        <ul style={listStyle}>まだ登録された単語がありません。</ul>
      )}
      {list.length === 0 && !!searchText && (
        <ul style={listStyle}>検索結果はありませんでした。</ul>
      )}
      {list.length > 0 && (
        <ul style={listStyle}>
          {list.map(({ word, referenceCount, hidden }) => {
            return (
              <ListItem
                key={word}
                word={word}
                referenceCount={referenceCount}
                onHideItem={onRemoveEvent}
                onRemoveItem={onRemoveEvent}
                hidden={hidden}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
};

const ReactDOM = createRoot(document.getElementById("root")!);

ReactDOM.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
