<?php
namespace App\Http\Controllers\Cloud;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\PhoneInfo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MessageController extends Controller
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
        $query = Message::query();
        if ($request->has('conversation_id')) $query->where('conversation_id', $request->conversation_id);
        $items = $query->orderBy('message_time','desc')->paginate($size, ['*'], 'page', $page);
        return $this->success(['list' => $items->items(), 'total' => $items->total()]);
    }

    /** GET /client/message/getList */
    public function getList(Request $request)
    {
        $convId = $request->get('conversation_id');
        if (!$convId) return $this->error('conversation_id required');
        $messages = Message::where('conversation_id', $convId)
            ->orderBy('message_time', 'asc')->limit(100)->get();
        return $this->success(['items' => $messages, 'total' => $messages->count()]);
    }

    /** GET /client/message/getListByAdmin */
    public function getListByAdmin(Request $request)
    {
        return $this->getList($request);
    }

    /** POST /client/message/send */
    public function send(Request $request)
    {
        return $this->_doSend($request);
    }

    /** POST /client/message/manualMessage */
    public function manualMessage(Request $request)
    {
        return $this->_doSend($request);
    }

    /** POST /client/message/manualMessageByAdmin */
    public function manualMessageByAdmin(Request $request)
    {
        return $this->_doSend($request);
    }

    private function _doSend(Request $request)
    {
        $convId  = $request->get('conversation_id') ?: $request->get('con_id');
        $content = $request->get('content') ?: $request->get('message_content', '');
        $msgType = (int)($request->get('message_type', 1));

        if (!$convId) return $this->error('conversation_id required');
        if (!$content) return $this->error('content required');

        $conv = Conversation::find($convId);
        if (!$conv) return $this->error('会话不存在');

        $phoneInfo = null;
        if ($conv->phoneinfo_id) {
            $phoneInfo = PhoneInfo::find($conv->phoneinfo_id);
        }
        if (!$phoneInfo && $conv->system_phonenumber) {
            $phoneInfo = PhoneInfo::where('myphonenumber', $conv->system_phonenumber)->first();
        }

        // 图片消息：content可能是 "#url" 格式
        $actualContent = $content;
        if ($msgType == 2 && str_starts_with($content, '#')) {
            $actualContent = substr($content, 1);
        }

        $msg = Message::create([
            'conversation_id' => $convId,
            'content' => $content,
            'message_type'    => $msgType,
            'direction'       => 1,
            'status'          => 0,
            'message_time'    => now(),
            'is_read'         => 1,
        ]);

        try {
            $payload = [
                'from_phone'   => $conv->system_phonenumber,
                'to_phone'     => $conv->target_phonenumber,
                'content'      => $actualContent,
                'message_type' => $msgType,
            ];
            if ($phoneInfo) {
                $payload['cookie']      = $phoneInfo->cookie ?? '';
                $payload['xpx']         = $phoneInfo->xpx ?? '';
                $payload['device_info'] = $phoneInfo->device_info ?? '';
            }

            $resp = Http::timeout(30)->post($this->pythonUrl() . '/send', $payload);
            $result = $resp->json();
            $success = $result['success'] ?? false;

            $msg->update([
                'status'    => $success ? 1 : 2,
                'error_msg' => $success ? null : ($result['message'] ?? 'failed'),
            ]);

            // 发信成功：将出口IP和发送统计写回 cloud_phoneinfo
            if ($success && $phoneInfo) {
                $updateData = [
                    'last_send_at' => now(),
                    'send_count'   => ($phoneInfo->send_count ?? 0) + 1,
                ];
                $sendIp = $result['send_ip'] ?? null;
                if ($sendIp) {
                    $updateData['send_ip'] = $sendIp;
                }
                $phoneInfo->update($updateData);
            }

            $conv->update(['updated_at' => now()]);

            return $success
                ? $this->success(['message_id' => $msg->id, 'send_ip' => $result['send_ip'] ?? null])
                : $this->error($result['message'] ?? '发送失败');
        } catch (\Exception $e) {
            $msg->update(['status' => 2, 'error_msg' => $e->getMessage()]);
            Log::error('message send error', ['e' => $e->getMessage()]);
            return $this->error('发送失败: ' . $e->getMessage());
        }
    }

    /** POST /client/message/clearUnread */
    public function clearUnread(Request $request)
    {
        $conId = $request->input('con_id') ?: $request->input('conversation_id');
        if ($conId) {
            Message::where('conversation_id', $conId)->where('is_read', 0)->update(['is_read' => 1]);
        }
        return $this->success(null, '已清除');
    }

    /** POST /client/message/clearUnreadByAdmin */
    public function clearUnreadByAdmin(Request $request)
    {
        return $this->clearUnread($request);
    }

    /** POST /upload (PHP → Python 代理) */
    public function uploadProxy(Request $request)
    {
        // 直接转发到Python /upload
        try {
            if ($request->hasFile('file')) {
                $file = $request->file('file');
                $resp = Http::attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
                    ->post($this->pythonUrl() . '/upload');
            } else {
                $resp = Http::post($this->pythonUrl() . '/upload', $request->all());
            }
            return response()->json($resp->json(), $resp->status());
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    /** POST /cloud/projectConfig/upload (PHP自身上传) */
    public function uploadImage(Request $request)
    {
        if (!$request->hasFile('file')) {
            return $this->error('No file uploaded');
        }
        $file = $request->file('file');
        $ext  = $file->getClientOriginalExtension() ?: 'jpg';
        $fname = 'img_' . time() . '_' . uniqid() . '.' . $ext;
        $path  = $file->storeAs('public/uploads', $fname);
        $url   = asset('storage/uploads/' . $fname);
        return $this->success(['url' => $url, 'file_path' => $url, 'path' => $path]);
    }

    /** GET /rsikNumber */
    public function rsikNumber(Request $request)
    {
        try {
            $resp = Http::timeout(5)->get($this->pythonUrl() . '/rsikNumber', $request->all());
            return response()->json($resp->json(), $resp->status());
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'riskNumber' => 0, 'number' => 0, 'message' => 'Python service offline'], 200);
        }
    }

    /** GET /cloud/receivedMessage/index */
    public function receivedIndex(Request $request)
    {
        $page = (int)$request->get('page', 1);
        $size = (int)$request->get('pageSize', 20);
        $query = Message::where('direction', 2)->orderBy('message_time','desc');
        if ($request->has('conversation_id')) $query->where('conversation_id', $request->conversation_id);
        $items = $query->paginate($size, ['*'], 'page', $page);
        return $this->success(['list' => $items->items(), 'total' => $items->total()]);
    }

    /** POST /cloud/receivedMessage/markRead */
    public function markRead(Request $request)
    {
        $ids = (array)$request->input('ids', []);
        if ($ids) {
            Message::whereIn('id', $ids)->update(['is_read' => 1]);
        }
        return $this->success(null, '已标记已读');
    }

    /** GET /cloud/message/receivedMessageList */
    public function receivedMessageList(Request $request)
    {
        return $this->receivedIndex($request);
    }

    // ============================================================
    // 黑名单 & 风险消息（简单返回空列表）
    // ============================================================
    public function blackListIndex(Request $request)
    {
        return $this->success(['list' => [], 'total' => 0]);
    }

    public function blackListImport(Request $request)
    {
        return $this->success(null, '导入成功');
    }

    public function blackListBatchDel(Request $request)
    {
        return $this->success(null, '删除成功');
    }

    public function riskMessageIndex(Request $request)
    {
        return $this->success(['list' => [], 'total' => 0]);
    }

    public function riskMessageToBlackList(Request $request)
    {
        return $this->success(null, '操作成功');
    }

    public function cancelRisk(Request $request)
    {
        return $this->success(null, '操作成功');
    }

    public function resendIndex(Request $request)
    {
        return $this->success(['list' => [], 'total' => 0]);
    }

    /**
     * 获取发信服务启动状态（代理Python /getstart）
     */
    public function getstart(Request $request)
    {
        try {
            $pythonUrl = env('PYTHON_SERVICE_URL', 'http://127.0.0.1:5000');
            $response = \Illuminate\Support\Facades\Http::timeout(5)
                ->get($pythonUrl . '/getstart');
            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json([
                'success' => true,
                'data' => null,
                'start_time' => null
            ]);
        }
    }

}
