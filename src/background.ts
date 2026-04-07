import { Item } from "./types";

// 拡張機能がインストールされたときの処理
chrome.runtime.onInstalled.addListener(function () {
  // 親階層のメニューを生成
  chrome.contextMenus.create({
    type: "normal",
    id: "save-word",
    title: "単語を保存",
    contexts: ["selection"],
  });
});

/**
 * メニューが選択されたときの処理
 * 選択されたアイテムはこちらの関数の引数に入ってくる(今回は item)
 * menuItemIdでmenuのidが文字列で取得できる
 */
chrome.contextMenus.onClicked.addListener(async function (item) {
  const selectionText = item.selectionText;
  if (selectionText) {
    const previousData = (await chrome.storage.local.get(
      selectionText
    )) as Record<string,Item>;
    await chrome.storage.local.set({
      [selectionText]: {
        ...previousData[selectionText],
        referenceCount: (previousData[selectionText]?.referenceCount ?? 0) + 1,
        hidden: false,
      },
    });
    await chrome.runtime.sendMessage({
      event: 'updateStorage'
    })
  }
});
