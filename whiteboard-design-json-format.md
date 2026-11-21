# ホワイトボード画面設計JSON 形式定義

対象は画面設計ボードの「JSONを取り込む」。形式のバージョンは `1.0`。実装の確認基準はコミット `c370b9d3988c305ed1f368d556ea49df56b54f5c`。本番で取り込みを確認した実例は、同梱の `pagelink-design.json`（3画面、20部品、5遷移）。

## Codexへの依頼文

> 添付の「ホワイトボード画面設計JSON 形式定義」と `pagelink-design.json` を参照し、以下の要件をホワイトボードの「JSONを取り込む」で読み込める画面設計にしてください。
>
> 要件を画面、UI部品、遷移に分け、操作や条件は対応する項目に記入してください。未決定事項は `decisions` に残してください。画面同士を重ねず、部品を所属画面の枠内に配置し、座標はキャンバス基準で指定してください。
>
> 特定の画面や部品に関連するメモ・案は、`relatedItemId` に対象のIDを設定してください。ボード全体に関するメモ・案では、`relatedItemId` と `screenId` を省略してください。
>
> ボタンを押したときの行き先は、ボタン部品の `components[].data.linkScreenId` に遷移先の画面IDを設定してください。条件や補足は `linkNote` に記入してください。同じ移動を `transitions` にも登録すると矢印が重複するため、ボタンのリンクとして表す移動は部品側に記述してください。
>
> `transitions` に同じ向きの画面遷移（例 A → B）を2件以上入れると取り込みエラーになります。操作や条件が異なる場合も同じ画面ペアは1件にまとめ、必要な条件をその1件に記入してください。逆向き（B → A）は別の遷移として登録できます。
>
> 出力はUTF-8の `design.json` ファイルにしてください。保存前に、JSONの構文、100 KiB以下、全要素のIDの一意性、ID参照の整合性、画面遷移の方向付き重複がないことを確認してください。
>
> 要件：〈ここに作りたい画面や操作を書く〉

## ファイル全体

- `schemaVersion` は必須。文字列の `"1.0"` を指定する。
- `screens` は必須の配列。通常は1画面以上を含める。
- `components`、`transitions`、`interactionNotes`、`decisions` は任意の配列。使わない場合は空配列または省略。取り込みには全配列を通じて少なくとも1要素が必要。
- `board` は省略できる。サンプルの `board.title` や `board.url` は参考情報で、取り込み先のボード名やURLには反映されない。
- UTF-8のJSONを100 KiB（102,400バイト）以下にする。コメント、末尾カンマ、Markdownのコードフェンスはファイルに含めない。

## 各要素の共通項目

| 項目 | 指定方法 |
| --- | --- |
| `id` | 必須。空でない文字列。全配列を通じて一意にする。例 `search-screen` |
| `kind` | 必須。下表の配列と一致させる |
| `x`, `y` | キャンバス左上を基準としたピクセル座標。部品も画面内の相対座標ではなくキャンバス上の座標を使う |
| `width`, `height` | ピクセル単位。幅40〜5000、高さ28〜5000の範囲で指定する |
| `zIndex` | 重なり順を指定する整数 |
| `data` | 種類ごとの情報を入れるオブジェクト。下表を参照 |

配置する要素には座標・寸法・重なり順を明示する。遷移矢印は接続先の画面から描画されるため、遷移要素の位置や寸法は省略できる。

## 種類ごとの `data`

| 配列 | `kind` | 主な項目 |
| --- | --- | --- |
| `screens` | `screen` | `name`（画面名）、`description`（画面の目的） |
| `components` | `component` | `name`、`componentType`、`screenId`（所属画面）、`behavior`（操作時の動作）、`memo`（補足）、`linkScreenId`（リンク先画面）、`linkNote`（リンクの条件や補足） |
| `transitions` | `transition` | `fromScreenId` と `toScreenId` は必須。任意で `trigger`（操作）、`condition`（条件） |
| `interactionNotes` | `note` | `title`、`body`、任意で `relatedItemId`（関連する対象のID）と `screenId` |
| `decisions` | `decision` | `question`、`options`（文字列の配列）、`resolution`、`status`（`open` または `decided`）、`done`（真偽値。通常は `false`）、任意で `relatedItemId`（関連する対象のID）と `screenId` |

メモ・案の右ペインにある「関連する対象」は `relatedItemId` で指定する。自動整頓もこのIDを参照し、画面や部品に関連付けたメモ・案をその画面と一緒に移動する。対象画面から大きく離れたメモ・案は、自動整頓時にその画面の近くへ寄せる。`screenId` だけを指定したメモ・案も「関連付けなし」と表示される。関連付けのないメモ・案は、自動整頓で画面の下にまとめる。

ID参照には同じファイル内の要素の `id` を使う。画面IDを指定する項目は `screens` 内の要素を参照する。取り込み時に新しいIDが割り当てられ、ファイル内の参照も付け替わる。遷移は別の画面に接続する。

- ボタンのプロパティに「リンク先画面」を表示するには、ボタン部品の `components[].data.linkScreenId` に遷移先の画面IDを設定する。条件や補足は `components[].data.linkNote` に記入できる。
- 画面間の遷移として記録する場合は `transitions` を使う。`trigger` と同じ名前の部品が遷移元の画面内に1つだけあると、その部品を起点に矢印が描画される。ボタンのプロパティにリンク先を表示するには `linkScreenId` の指定が必要。
- `transitions` で `fromScreenId` と `toScreenId` の組が同じ遷移を2件以上記述すると、JSONの取り込み時にエラーになる。ID、操作、条件が異なっていても A → B は1件まで。B → A は別の遷移として登録できる。

部品の `componentType` は `button`、`input`、`dropdown`、`text`、`list`、`image`、`box`、`header`、`footer`、`sidebar-left`、`sidebar-right`、`menu` から選ぶ。テキスト部品の表示文言は `textContent` に入れる。メニューは `menuDirection`（`auto`、`horizontal`、`vertical`）と `menuItems` を使う。メニュー項目は `label` と、必要に応じて `linkScreenId`、`note` を持つ。

## 取り込みと確認

新しい画面設計ボードで「JSONを取り込む」からファイルを選ぶ。画面、部品、遷移を確認し、再読み込みして保存されていることを確かめる。既存ボードへ取り込むと要素が追加され、既存要素の下に配置される。同じファイルを再度取り込むと別の要素として追加される。
