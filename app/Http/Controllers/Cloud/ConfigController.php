<?php
namespace App\Http\Controllers\Cloud;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConfigController extends Controller
{
    private function success($data = null, $message = 'Ok')
    {
        return response()->json(['success' => true, 'code' => 200, 'message' => $message, 'data' => $data]);
    }

    private function error($message = 'Error', $code = 400)
    {
        return response()->json(['success' => false, 'code' => $code, 'message' => $message], 200);
    }

    /**
     * GET /cloud/config/getByKey?config_key=is_rand_emoji
     * 表结构: system_config(id, key, value, name, ...)
     */
    public function getByKey(Request $request)
    {
        $key = $request->get('config_key') ?: $request->get('key') ?: $request->get('config');
        if (!$key) {
            return $this->error('config_key required');
        }

        $config = DB::table('system_config')->where('key', $key)->first();

        if (!$config) {
            // 返回默认值
            $defaults = [
                'is_rand_emoji'          => ['switch' => 0],
                'customer_service_switch' => ['switch' => -1],
                'python_service_url'      => ['value' => ''],
            ];
            $configValue = $defaults[$key] ?? ['switch' => 0];
        } else {
            $rawValue = $config->value ?? '';
            // 尝试解析为JSON
            $decoded = json_decode($rawValue, true);
            $configValue = $decoded !== null ? $decoded : ['value' => $rawValue, 'switch' => $rawValue];
        }

        return $this->success($configValue);
    }

    public function save(Request $request)
    {
        $key   = $request->input('config_key') ?: $request->input('key');
        $value = $request->input('config_value') ?: $request->input('value');
        if (!$key) return $this->error('config_key required');

        $valueStr = is_array($value) ? json_encode($value) : (string)$value;
        $exists = DB::table('system_config')->where('key', $key)->first();
        if ($exists) {
            DB::table('system_config')->where('key', $key)->update(['value' => $valueStr, 'updated_at' => now()]);
        } else {
            DB::table('system_config')->insert(['key' => $key, 'value' => $valueStr, 'created_at' => now(), 'updated_at' => now()]);
        }
        return $this->success(null, '保存成功');
    }

    public function uploadInfo(Request $request)
    {
        return $this->success(['upload_url' => '/cloud/projectConfig/upload', 'domain' => '']);
    }

    public function listAll(Request $request)
    {
        $items = \Illuminate\Support\Facades\DB::table("system_config")->get();
        return response()->json(["success"=>true,"code"=>200,"data"=>["items"=>$items,"total"=>count($items)]]);
    }

    public function projectConfigSelectGet(Request $request)
    {
        // 返回项目配置选择列表（前端初始化时调用）
        $projectId = $request->get('project_id');
        $configs = [];
        if ($projectId) {
            $configs = \Illuminate\Support\Facades\DB::table('system_config')
                ->where('key', 'LIKE', 'project_%')
                ->get()->toArray();
        }
        return response()->json([
            'success' => true, 'code' => 200,
            'data' => ['items' => $configs, 'total' => count($configs)]
        ]);
    }

}
