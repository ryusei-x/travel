// index.html で window に設定された Firestore の関数とインスタンスを使用します。

// グローバル変数から必要な関数とインスタンスを取得
const db = window.db;
const addDoc = window.addDoc;
const collection = window.collection;
const serverTimestamp = window.serverTimestamp;
const query = window.query;
const orderBy = window.orderBy;
const onSnapshot = window.onSnapshot;
const docRef = window.doc; // doc関数は docRef という変数名で取得
const updateDoc = window.updateDoc;
const increment = window.increment;
const arrayUnion = window.arrayUnion;
const arrayRemove = window.arrayRemove;
const getDoc = window.getDoc;

// 1. 必要な HTML 要素の取得
const postButton = document.getElementById('postButton');
const authorInput = document.getElementById('author');
const contentInput = document.getElementById('content');
const postsDiv = document.getElementById('posts');
// ★注意: この変数への要素の代入は、以下の window.onload 内に移動します。
let lineShareButton; 

// 2. 投稿ボタンクリック時の処理（書き込み処理）
postButton.addEventListener('click', async () => {
    
    // ニックネームが空欄の場合「匿名ファン」をデフォルトにする
    const author = authorInput.value.trim() || '匿名ファン'; 
    const content = contentInput.value.trim();

    if (!content) {
        // alert() は非推奨ですが、ここでは動作確認のため使用
        alert("コメントを入力してください！");
        return;
    }

    try {
        const postsCollectionRef = collection(db, "posts");
        
        // データを追加。いいね用のフィールドを初期化
        await addDoc(postsCollectionRef, {
            author: author,
            content: content,
            timestamp: serverTimestamp(),
            likesCount: 0, 
            likedBy: [], // いいねしたユーザー名（ニックネーム）を格納する配列
        });

        // フォームをクリア
        contentInput.value = '';

    } catch (error) {
        console.error("投稿エラー:", error);
        alert("投稿中にエラーが発生しました。コンソールを確認してください。");
    }
});


// 3. いいね機能の実装 (トグル式)
async function toggleLike(postId, currentAuthor) {
    
    let authorToUse = currentAuthor;
    
    // ★【修正箇所】ニックネームが空の場合、「匿名いいね」を使用★
    if (!authorToUse || authorToUse.trim() === '') {
        authorToUse = '匿名いいね'; // ニックネームが空欄の場合、固定の匿名ユーザー名を使用
    } else {
        authorToUse = authorToUse.trim();
    }
    // ----------------------------------------------------
    
    const postRef = docRef(db, "posts", postId);
    
    // 現在の投稿ドキュメントを取得して、いいね状態を確認
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) {
        console.error("投稿が見つかりません:", postId);
        return;
    }
    
    const postData = postSnap.data();
    // authorToUseを使っていいね状態を確認
    const likedByArray = Array.isArray(postData.likedBy) ? postData.likedBy : [];
    const isLiked = likedByArray.includes(authorToUse);
    
    try {
        if (isLiked) {
            // いいねを解除: カウントを減らし、ニックネームを配列から削除
            await updateDoc(postRef, {
                likesCount: increment(-1),
                likedBy: arrayRemove(authorToUse)
            });
        } else {
            // いいねを追加: カウントを増やし、ニックネームを配列に追加
            await updateDoc(postRef, {
                likesCount: increment(1),
                likedBy: arrayUnion(authorToUse)
            });
        }
    } catch (error) {
        console.error("いいね処理エラー:", error.message);
        alert("いいね処理中にエラーが発生しました。コンソールを確認してください。");
    }
}
window.toggleLike = toggleLike; // HTMLから呼び出せるようにグローバルに公開


// 4. 返信機能の処理 (prompt式)
async function postReply(postId) {
    
    let replyAuthor = authorInput.value.trim();

    // ニックネームが空の場合、promptで入力を求める
    if (!replyAuthor) {
        replyAuthor = prompt("返信をするためのニックネームを入力してください:");
        if (!replyAuthor || replyAuthor.trim() === '') {
            alert("ニックネームが入力されなかったため、返信できません。");
            return;
        }
        replyAuthor = replyAuthor.trim();
    }
    
    const replyContent = prompt("返信コメントを入力してください:");
    if (!replyContent || replyContent.trim() === '') {
        return;
    }

    try {
        // 返信は投稿ドキュメントのサブコレクション 'replies' に追加
        const repliesCollectionRef = collection(db, "posts", postId, "replies");
        await addDoc(repliesCollectionRef, {
            author: replyAuthor,
            content: replyContent,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("返信投稿エラー:", error);
        alert("返信投稿中にエラーが発生しました。コンソールを確認してください。");
    }
}
window.postReply = postReply; // HTMLから呼び出せるようにグローバルに公開


// 5. リアルタイムでの投稿表示処理（読み込み処理）

// 投稿に返信を表示するサブ関数
function renderReplies(postDocId, repliesDiv) {
    // サブコレクション 'replies' へのクエリ
    const repliesQuery = query(
        collection(db, "posts", postDocId, "replies"),
        orderBy("timestamp", "asc")
    );

    // 返信のリアルタイムリスナーを設定
    onSnapshot(repliesQuery, (replySnapshot) => {
        repliesDiv.innerHTML = ''; // 既存の返信リストをクリア
        
        if (replySnapshot.empty) {
            repliesDiv.innerHTML = '<small style="color:#666; display:block; padding:5px 0;">まだ返信はありません。</small>';
            return;
        }

        replySnapshot.forEach(replyDoc => {
            const reply = replyDoc.data();
            const replyElement = document.createElement('div');
            replyElement.className = 'reply-card';

            const dateObject = reply.timestamp ? reply.timestamp.toDate() : null;
            const dateString = dateObject ? dateObject.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '投稿中...';
            
            replyElement.innerHTML = `
                <div class="reply-content-box">
                    <p>${reply.content}</p>
                    <small><strong>${reply.author}</strong> (${dateString})</small>
                </div>
            `;
            repliesDiv.appendChild(replyElement);
        });
    });
}


// メインの投稿リスナー
const postsQuery = query(
    collection(db, "posts"),
    orderBy("timestamp", "desc") // 新しい投稿順に並べ替え
);

onSnapshot(postsQuery, (snapshot) => {
    postsDiv.innerHTML = ''; 

    snapshot.forEach(doc => {
        const post = doc.data();
        const postId = doc.id;
        const postElement = document.createElement('div');
        postElement.className = 'post-card';
        
        const dateObject = post.timestamp ? post.timestamp.toDate() : null;
        const dateString = dateObject ? dateObject.toLocaleString('ja-JP') : '投稿中...';
        
        // ニックネーム入力欄から現在のユーザー名を取得（いいねの判定に使用）
        const currentAuthor = authorInput.value.trim(); 
        
        // いいねの判定に使用するユーザー名を決定 (ニックネームがあればそれ、なければ '匿名いいね')
        const authorForLikeCheck = currentAuthor || '匿名いいね';
        
        const likedByArray = Array.isArray(post.likedBy) ? post.likedBy : [];
        const isLiked = likedByArray.includes(authorForLikeCheck);
        const likeButtonClass = isLiked ? 'liked' : '';
        const likeButtonText = isLiked ? '★いいね解除' : 'いいね！';

        // onclickに渡す文字列に含まれる可能性のあるシングルクォートをエスケープ処理
        // ここに渡すのは入力欄の値なので currentAuthor を使用
        const escapedAuthor = currentAuthor.replace(/'/g, "\\'"); 
        
        postElement.innerHTML = `
            <div class="post-header">
                <strong>${post.author}</strong>
                <span class="post-date">${dateString}</span>
            </div>
            <p class="post-content">${post.content}</p>
            <div class="post-actions">
                <button 
                    class="like-button ${likeButtonClass}" 
                    onclick="window.toggleLike('${postId}', '${escapedAuthor}')"
                >
                    ${likeButtonText} (${post.likesCount || 0})
                </button>
                <button 
                    class="reply-button" 
                    onclick="window.postReply('${postId}')"
                >
                    返信する
                </button>
            </div>
            <div class="replies-section" id="replies-${postId}">
                </div>
        `;
        
        // ページに追加
        postsDiv.appendChild(postElement);

        // 返信セクションのレンダリングを開始
        const repliesDiv = postElement.querySelector(`#replies-${postId}`);
        renderReplies(postId, repliesDiv);
    });
});


// ★修正: window.onload を使用して、DOM読み込み完了後にイベントリスナーを設定します。
window.onload = function() {
    // lineShareButton をここで取得し直す
    const lineShareButton = document.getElementById('lineShareButton');

    if (lineShareButton) {
        lineShareButton.addEventListener('click', (event) => {
            // デフォルトのリンク遷移をキャンセル
            event.preventDefault(); 
            
            // 共有メッセージとURLをエンコード
            const shareText = 'ミステリーSNS「オタクのたまり場」で語り合おう！';
            const currentUrl = window.location.href; 
            
            const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
            
            // 新しいタブで共有ページを開く
            window.open(lineUrl, '_blank');
        });
    }
};
// ★修正終わり: 既存のLINE共有ロジックを window.onload 関数で囲みました。