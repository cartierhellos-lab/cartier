<?php
namespace App\Http\Controllers\Cloud;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\PhoneInfo;
use App\Models\CloudProject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ConversationController extends Controller
{
    private function pythonUrl()
    {
        return config('app.python_service_url', 'http://127.0.0.1:5000');
    }

    private function success($data = null, $message = 'Ok')
    {
        return response()->json(['success' => true, 'code' => 200, 'message' => $message, 'data' => $data]);
    }

    private function error($message = 'Error', $code = 1002)
    {
        return response()->json(['success' => false, 'message' => $message, 'code' => $code]);
    }

    public function index(Request $request)
    {
        $page = (int)$request->get('page', 1);
        $size = (int)$request->get('pageSize', 20);
        $query = Conversation::whereNull('deleted_at');
        if ($request->has('project_key')) $query->where('project_key', $request->project_key);
        if ($request->has('user_id')) $query->where('user_id', $request->user_id);
        $items = $query->orderBy('updated_at','desc')->paginate($size, ['*'], 'page', $page);
        return $this->success(['list' => $items->items(), 'total' => $items->total()]);
    }

    /** GET /client/conversaion/getList */
    public function getList(Request $request)
    {
        $page = (int)$request->get('page', 1);
        $size = (int)$request->get('pageSize', 20);
        $projectKey = $request->get('project_key', 'america');
        $userId = auth()->id();

        $query = Conversation::whereNull('deleted_at')
            ->where('project_key', $projectKey);
        if ($userId) $query->where('user_id', $userId);

        $items = $query->orderBy('updated_at','desc')->paginate($size, ['*'], 'page', $page);

        $list = collect($items->items())->map(function($conv) {
            $lastMsg = Message::where('conversation_id', $conv->id)
                ->orderBy('id','desc')->first();
            return array_merge($conv->toArray(), [
                'last_message' => $lastMsg ? $lastMsg->message_content : '',
                'last_time'    => $lastMsg ? $lastMsg->message_time : $conv->created_at,
                'num_of_unread' => Message::where('conversation_id', $conv->id)
                    ->where('is_read', 0)->where('direction', 2)->count(),
            ]);
        });

        return $this->success(['list' => $list, 'total' => $items->total()]);
    }

    /** GET /client/conversaion/getListByAdmin */
    public function getListByAdmin(Request $request)
    {
        return $this->getList($request);
    }

    /** POST /client/conversaion/create and /client/commonConversation/create */
    public function create(Request $request)
    {
        $projectId = $request->get('project_id');
        $projectKey = $request->get('project_key', 'america');

        if ($projectId) {
            $project = CloudProject::find($projectId);
            if (!$project) return $this->error('项目不存在');
            $projectKey = $project->project_key ?? $projectKey;
        }

        $conv = Conversation::firstOrCreate([
            'system_phonenumber' => $request->get('system_phonenumber') ?: $request->get('from_phone'),
            'target_phonenumber' => $request->get('target_phonenumber') ?: $request->get('to_phone'),
            'project_key' => $projectKey,
        ], [
            'phoneinfo_id' => $request->get('phoneinfo_id'),
            'user_id'      => auth()->id(),
            'status'       => 1,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);
        return $this->success($conv);
    }

    /** POST /client/conversaion/createv2 */
    public function createv2(Request $request)
    {
        return $this->create($request);
    }

    /** GET /client/conversaion/getConfig */
    public function getConfig(Request $request)
    {
        $projectKey = $request->get('project_key', 'america');
        // 返回客服开关等配置
        $configs = DB::table('system_config')
            ->whereIn('key', ['customer_service_switch', 'is_rand_emoji'])
            ->get();
        $result = $configs->map(function($c) {
            return [
                'config_id'    => $c->key,
                'config_value' => $c->value,
                'config_desc'  => $c->name ?? '',
                'created_at'   => $c->created_at ?? now(),
            ];
        });
        return $this->success($result);
    }

    /** GET /client/conversaion/getNumOfUnread */
    public function getNumOfUnread(Request $request)
    {
        $userId = auth()->id();
        $count = Message::where('is_read', 0)->where('direction', 2)
            ->whereHas('conversation', function($q) use ($userId) {
                $q->where('user_id', $userId)->whereNull('deleted_at');
            })->count();
        return $this->success(['count' => $count, 'total' => $count]);
    }

    /** GET /client/conversaion/getNumOfUnreadByAdmin */
    public function getNumOfUnreadByAdmin(Request $request)
    {
        $count = Message::where('is_read', 0)->where('direction', 2)->count();
        return $this->success(['count' => $count, 'total' => $count]);
    }

    /** POST /client/conversaion/setFavorite */
    public function setFavorite(Request $request)
    {
        $id = $request->input('id');
        $isFavorite = (int)$request->input('is_favorite', 0);
        Conversation::where('id', $id)->update(['is_favorite' => $isFavorite]);
        return $this->success(null, '操作成功');
    }

    // ============================================================
    // commonConversation 路由（dialogbox页面核心接口）
    // ============================================================

    /**
     * POST /client/commonConversation/sendMessage
     * 参数: {con_id, message_content}
     * message_type=2(图片)时 message_content 为 "#url" 格式
     */
    public function sendMessage(Request $request)
    {
        $conId = $request->input('con_id');
        $messageContent = $request->input('message_content', '');

        if (!$conId) return $this->error('con_id required');
        if (!$messageContent) return $this->error('message_content required');

        // 判断消息类型（图片以#开头）
        $msgType = 1; // 文本
        $actualContent = $messageContent;
        if (str_starts_with($messageContent, '#')) {
            $msgType = 2; // 图片
            $actualContent = substr($messageContent, 1); // 去掉#前缀
        }

        // 获取对话信息
        $conv = Conversation::find($conId);
        if (!$conv) return $this->error('对话不存在');

        // 获取发信账号信息
        $phoneInfo = null;
        if ($conv->phoneinfo_id) {
            $phoneInfo = PhoneInfo::find($conv->phoneinfo_id);
        }
        if (!$phoneInfo && $conv->system_phonenumber) {
            $phoneInfo = PhoneInfo::where('myphonenumber', $conv->system_phonenumber)->first();
        }

        // 保存消息记录
        $msg = Message::create([
            'conversation_id' => $conId,
            'content' => $messageContent,
            'message_type'    => $msgType,
            'direction'       => 1, // 1=发出
            'status'          => 0, // 0=待发送
            'message_time'    => now(),
            'is_read'         => 1,
        ]);

        // 调用Python服务发送
        try {
            $payload = [
                'from_phone'   => $conv->system_phonenumber,
                'to_phone'     => $conv->target_phonenumber,
                'content'      => $actualContent,
                'message_type' => $msgType,
            ];
            if ($phoneInfo) {
                $payload['cookie'] = $phoneInfo->cookie ?? '';
                $payload['xpx']    = $phoneInfo->xpx ?? '';
                $payload['device_info'] = $phoneInfo->device_info ?? '';
            }

            $pythonResp = Http::timeout(30)->post($this->pythonUrl() . '/send', $payload);
            $result = $pythonResp->json();

            $success = $result['success'] ?? false;
            $msg->update([
                'status'    => $success ? 1 : 2,
                'error_msg' => $success ? null : ($result['message'] ?? 'Send failed'),
            ]);

            $conv->update(['updated_at' => now()]);

            if ($success) {
                return $this->success(['message_id' => $msg->id]);
            } else {
                return $this->error($result['message'] ?? '发送失败');
            }
        } catch (\Exception $e) {
            $msg->update(['status' => 2, 'error_msg' => $e->getMessage()]);
            Log::error('sendMessage error', ['error' => $e->getMessage()]);
            return $this->error('发送失败: ' . $e->getMessage());
        }
    }

    /**
     * GET /client/commonConversation/getTcardMessageList
     * 参数: {conversation_id}
     */
    public function getTcardMessageList(Request $request)
    {
        $convId = $request->get('conversation_id');
        if (!$convId) return $this->error('conversation_id required');

        $messages = Message::where('conversation_id', $convId)
            ->orderBy('id', 'asc')
            ->limit(100)
            ->get()
            ->map(function($m) {
                return [
                    'id'              => $m->id,
                    'conversation_id' => $m->conversation_id,
                    'message_content' => $m->message_content,
                    'message_type'    => $m->message_type,
                    'direction'       => $m->direction,
                    'status'          => $m->status,
                    'message_time'    => $m->message_time,
                    'is_read'         => $m->is_read,
                ];
            });

        // 标记为已读
        Message::where('conversation_id', $convId)
            ->where('direction', 2)
            ->where('is_read', 0)
            ->update(['is_read' => 1]);

        return $this->success(['items' => $messages, 'total' => $messages->count()]);
    }

    /** POST /client/commonConversation/clearUnread */
    public function clearUnread(Request $request)
    {
        $conId = $request->input('con_id');
        if ($conId) {
            Message::where('conversation_id', $conId)
                ->where('is_read', 0)
                ->update(['is_read' => 1]);
            Conversation::where('id', $conId)->update(['num_of_unread' => 0]);
        }
        return $this->success(null, '已清除未读');
    }

    // ============================================================
    // 旧版方法保留
    // ============================================================
    public function createOneByOne(Request $request)
    {
        $systemPhone = $request->get('system_phonenumber');
        $targetPhone = $request->get('target_phonenumber');
        $projectKey  = $request->get('project_key', 'america');

        if (!$systemPhone || !$targetPhone) {
            return $this->error('缺少必要参数');
        }

        $phoneInfo = PhoneInfo::where('myphonenumber', $systemPhone)
            ->whereNull('deleted_at')->first();
        if (!$phoneInfo) {
            return $this->error('系统手机号码不存在或者不在线');
        }

        // 检查Python服务
        try {
            Http::timeout(3)->get($this->pythonUrl() . '/rsikNumber');
        } catch (\Exception $e) {
            return $this->error('系统手机号码不存在或者不在线');
        }

        $conv = Conversation::firstOrCreate([
            'system_phonenumber' => $systemPhone,
            'target_phonenumber' => $targetPhone,
            'project_key'        => $projectKey,
        ], [
            'phoneinfo_id' => $phoneInfo->id,
            'user_id'      => auth()->id(),
            'status'       => 1,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        return $this->success($conv);
    }

    public function delete(Request $request)
    {
        Conversation::whereIn('id', (array)$request->get('ids', []))->update(['deleted_at' => now()]);
        return $this->success(null, '删除成功');
    }
}
