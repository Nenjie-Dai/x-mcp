import { TwitterApi } from 'twitter-api-v2';
import { Config, TwitterError, Tweet, TwitterUser, PostedTweet } from './types.js';

export class TwitterClient {
  private client: TwitterApi;
  private rateLimitMap = new Map<string, number>();

  constructor(config: Config) {
    this.client = new TwitterApi({
      appKey: config.apiKey,
      appSecret: config.apiSecretKey,
      accessToken: config.accessToken,
      accessSecret: config.accessTokenSecret,
    });

    console.error('X-APIクライアント初期化完了');
  }

  async postTweet(text: string): Promise<PostedTweet> {
    try {
      const endpoint = 'tweets/create';
      // this.checkRateLimit も async 関数（後述）なので Promise を返します。
      // await を使うことで、checkRateLimit の処理が終わるまで postTweet メソッド内の次の行の実行は待機します。
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.tweet(text);
      
      console.error(`Tweet posted successfully with ID: ${response.data.id}`);
      
      return {
        id: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  async searchTweets(query: string, count: number): Promise<{ tweets: Tweet[], users: TwitterUser[] }> {
    try {
      const endpoint = 'tweets/search';
      await this.checkRateLimit(endpoint);

      const response = await this.client.v2.search(query, {
        max_results: count,
        // URL生成のためにuser_id必要
        expansions: ['author_id'],
        'tweet.fields': ['public_metrics', 'created_at'],
        'user.fields': ['username', 'name', 'verified']
      });

      console.error(`Fetched ${response.tweets.length} tweets for query: "${query}"`);

      // APIレスポンス全体の構造のイメージ
      // {
      //   "data": [ // ツイートの配列 (response.tweets に対応)
      //     { "id": "tweet1_id", "text": "...", "author_id": "userA_id" },
      //     { "id": "tweet2_id", "text": "...", "author_id": "userB_id" }
      //   ],
      //   "includes": { // 関連情報 (response.includes に対応)
      //     "users": [ // response.includes.users に対応
      //       { "id": "userA_id", "username": "UserA", "name": "User A Name", "verified": true },
      //       { "id": "userB_id", "username": "UserB", "name": "User B Name", "verified": false }
      //     ]
      //   }
      //   // ... 他のメタ情報
      // }
      const tweets = response.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        // Null合体演算子:tweet.author_id が null または undefined の場合に、右辺の '' (空文字列) を返す。
        // 必須のプロパティにデフォルト値を設定できます。
        authorId: tweet.author_id ?? '',
        metrics: {
          // オプショナルチェイニング演算子: 。
          // tweet.public_metrics が null または undefined の場合、like_count プロパティにアクセスしようとせずに undefined を返します。
          likes: tweet.public_metrics?.like_count ?? 0,
          retweets: tweet.public_metrics?.retweet_count ?? 0,
          replies: tweet.public_metrics?.reply_count ?? 0,
          quotes: tweet.public_metrics?.quote_count ?? 0
        },
        createdAt: tweet.created_at ?? ''
      }));

      const users = response.includes.users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        verified: user.verified ?? false
      }));

      return { tweets, users };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  private async checkRateLimit(endpoint: string): Promise<void> {
    const lastRequest = this.rateLimitMap.get(endpoint);
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      if (timeSinceLastRequest < 1000) { // Basic rate limiting
        throw new TwitterError(
          'レート制限超過',
          '前回の呼び出しから1秒未満です',
          429
        );
      }
    }
    this.rateLimitMap.set(endpoint, Date.now());
  }

  private handleApiError(error: unknown): never {
    if (error instanceof TwitterError) {
      throw error;
    }

    // Handle twitter-api-v2 errors
    const apiError = error as any;
    
    // ダックタイピング
    // twitter-api-v2のエラーはcodeを持っていることが多い
    if (apiError.code) {
      throw new TwitterError(
        apiError.message || 'Twitter API error',
        apiError.code,
        apiError.status
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in Twitter client:', error);
    throw new TwitterError(
      'An unexpected error occurred',
      'internal_error',
      500
    );
  }
}