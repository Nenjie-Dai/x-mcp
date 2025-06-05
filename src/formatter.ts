import { FormattedTweet, Tweet, TwitterUser, SearchResponse } from './types.js';

export class ResponseFormatter {
  static formatTweet(tweet: Tweet, user: TwitterUser, position: number): FormattedTweet {
    return {
      position,
      author: {
        username: user.username
      },
      content: tweet.text,
      metrics: tweet.metrics,
      url: `https://twitter.com/${user.username}/status/${tweet.id}`
    };
  }

  static formatSearchResponse(
    query: string,
    tweets: Tweet[],
    users: TwitterUser[]
  ): SearchResponse {
    // map メソッドのコールバック関数の引数:
    // 実は、map メソッドが呼び出す関数（コールバック関数と呼ばれます）は、最大3つの引数を受け取ることができます。
      // 現在の要素の値 (必須、例: num)
      // 現在の要素のインデックス (0から始まる番号) (任意)
      // map を呼び出した元の配列 (任意)

    // Map はキーと値のペアを保持するコレクション。
    // オブジェクトのキーが文字列かシンボルに限られるのに対し、Map のキーは任意の型にできて、要素の順序も保持される
    const userMap = new Map(users.map(user => [user.id, user]));
    
    const formattedTweets = tweets
      .map((tweet, index) => {
        const user = userMap.get(tweet.authorId);
        if (!user) return null;
        
        return this.formatTweet(tweet, user, index + 1);
      })
      .filter((tweet): tweet is FormattedTweet => tweet !== null);

    return {
      query,
      count: formattedTweets.length,
      tweets: formattedTweets
    };
  }

  static toMcpResponse(response: SearchResponse): string {
    const header = [
      'ツイートの取得結果',
      `クエリ: "${response.query}"`,
      `取得数: ${response.count} `,
      '='
    ].join('\n');

    if (response.count === 0) {
      return header + '\nクエリに合うツイートが見つかりませんでした';
    }

    const tweetBlocks = response.tweets.map(tweet => [
      `Tweet #${tweet.position}`,
      `From: @${tweet.author.username}`,
      `Content: ${tweet.content}`,
      `Metrics: ${tweet.metrics.likes} likes, ${tweet.metrics.retweets} retweets`,
      `URL: ${tweet.url}`,
      '='
    ].join('\n'));

    // ...tweetBlocks (スプレッド構文):
    // 配列やイテラブルオブジェクトを展開して、その要素を個別に扱えるようにします。
    // ここでは、tweetBlocks 配列の各要素（各ツイートの文字列ブロック）を header と同じレベルの要素として新しい配列に含めています
    return [header, ...tweetBlocks].join('\n\n');
  }
}