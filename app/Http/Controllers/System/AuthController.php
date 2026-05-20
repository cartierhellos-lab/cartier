<?php
namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->only('username', 'password');
        $user = User::where('username', $credentials['username'])->first();
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return response()->json(['success' => false, 'message' => '用户名或密码错误', 'code' => 1002]);
        }
        $token = JWTAuth::fromUser($user);
        $user->update(['login_ip' => $request->ip(), 'login_time' => now()]);
        return response()->json([
            'success' => true, 'message' => 'ok', 'code' => 200,
            'data' => ['token' => $token, 'expire_at' => now()->addWeek()->toDateTimeString()]
        ]);
    }

    public function logout()
    {
        try { JWTAuth::invalidate(JWTAuth::getToken()); } catch (\Exception $e) {}
        return response()->json(['success' => true, 'message' => 'ok', 'code' => 200]);
    }

    public function getInfo(Request $request)
    {
        $user = JWTAuth::parseToken()->authenticate();
        $isAdmin = $user->user_type == 100;

        // 获取当前项目配置（前端需要project_config字段，否则会请求/null导致卡死）
        $projectConfig = [
            'project_name'  => 'tcard',
            'menu_name'     => '阿凡达',
            'menu_name_en'  => 'Avatar',
            'title'         => '阿凡达',
            'logo_url'      => null,
            'logo_url2'     => null,
        ];

        // 尝试从数据库读取项目配置
        try {
            $project = \Illuminate\Support\Facades\DB::table('cloud_project')->first();
            if ($project) {
                $projectConfig['project_name'] = $project->project_key ?? 'tcard';
                $projectConfig['menu_name']    = $project->project_name ?? '阿凡达';
                $projectConfig['menu_name_en'] = $project->project_name ?? 'Avatar';
                $projectConfig['title']        = $project->project_name ?? '阿凡达';
            }
        } catch (\Exception $e) {}

        return response()->json([
            'success' => true, 'message' => 'ok', 'code' => 200,
            'data' => [
                'user' => [
                    'id'        => $user->id,
                    'username'  => $user->username,
                    'nickname'  => $user->nickname ?? $user->username,
                    'avatar'    => $user->avatar ?? '',
                    'user_type' => $user->user_type,
                    'status'    => $user->status,
                ],
                'roles'          => [$isAdmin ? 'superAdmin' : 'manager'],
                'permissions'    => ['*'],
                'codes'          => ['*'],
                'project_config' => $projectConfig,
            ]
        ]);
    }

    public function routerMenuTree(Request $request)
    {
        $user = JWTAuth::parseToken()->authenticate();
        $isAdmin = $user->user_type == 100;

        // 路由name必须用冒号格式（如 cloud:client），与前端路由守卫的 n({name:"cloud:client"}) 对应
        $menus = [
            [
                'id'        => 1,
                'name'      => 'america',
                'component' => 'Layout',
                'path'      => '/america',
                'redirect'  => '/america/dialogbox',
                'meta'      => [
                    'title'  => '美国SMS',
                    'icon'   => 'icon-message',
                    'type'   => 'M',
                    'hidden' => false,
                ],
                'children' => [
                    [
                        'id'        => 11,
                        'name'      => 'america:dialogbox',
                        'component' => 'america/dialogbox/index',
                        'path'      => 'dialogbox',
                        'meta'      => ['title' => '对话框', 'icon' => 'icon-message', 'type' => 'C', 'hidden' => false],
                    ],
                    [
                        'id'        => 12,
                        'name'      => 'america:taskList',
                        'component' => 'america/taskList/index',
                        'path'      => 'taskList',
                        'meta'      => ['title' => '任务列表', 'icon' => 'icon-list', 'type' => 'C', 'hidden' => false],
                    ],
                    [
                        'id'        => 13,
                        'name'      => 'america:massProduction',
                        'component' => 'america/massProduction/index',
                        'path'      => 'massProduction',
                        'meta'      => ['title' => '群发消息', 'icon' => 'icon-send', 'type' => 'C', 'hidden' => false],
                    ],
                    [
                        'id'        => 14,
                        'name'      => 'america:quickReply',
                        'component' => 'america/quickReply/index',
                        'path'      => 'quickReply',
                        'meta'      => ['title' => '快捷语', 'icon' => 'icon-bulb', 'type' => 'C', 'hidden' => false],
                    ],
                ],
            ],
        ];

        if ($isAdmin) {
            $menus[] = [
                'id'        => 2,
                'name'      => 'cloud',
                'component' => 'Layout',
                'path'      => '/cloud',
                'redirect'  => '/cloud/client',
                'meta'      => ['title' => '云控管理', 'icon' => 'icon-cloud', 'type' => 'M', 'hidden' => false],
                'children'  => [
                    [
                        'id'        => 21,
                        'name'      => 'cloud:client',
                        'component' => 'cloud/phoneNumber/index',
                        'path'      => 'client',
                        'meta'      => ['title' => '账号管理', 'icon' => 'icon-phone', 'type' => 'C', 'hidden' => false],
                    ],
                    [
                        'id'        => 22,
                        'name'      => 'cloud:project',
                        'component' => 'cloud/project/index',
                        'path'      => 'project',
                        'meta'      => ['title' => '项目管理', 'icon' => 'icon-apps', 'type' => 'C', 'hidden' => false],
                    ],
                    [
                        'id'        => 23,
                        'name'      => 'cloud:customer',
                        'component' => 'cloud/customer/index',
                        'path'      => 'customer',
                        'meta'      => ['title' => '客户管理', 'icon' => 'icon-user', 'type' => 'C', 'hidden' => false],
                    ],
                ],
            ];
        }


        // 统计分析
        $menus[] = ['id'=>3,'name'=>'statistics','component'=>'Layout',
            'path'=>'/statistics','redirect'=>'/statistics/data',
            'meta'=>['title'=>'统计分析','icon'=>'icon-bar-chart','type'=>'M','hidden'=>false],
            'children'=>[['id'=>31,'name'=>'america:data','component'=>'america/data/index',
                'path'=>'data','meta'=>['title'=>'数据统计','icon'=>'icon-bar-chart','type'=>'C','hidden'=>false]]]];
        // 批量任务
        $menus[] = ['id'=>4,'name'=>'batchTask','component'=>'Layout',
            'path'=>'/batchTask','redirect'=>'/batchTask/index',
            'meta'=>['title'=>'批量任务','icon'=>'icon-upload','type'=>'M','hidden'=>false],
            'children'=>[['id'=>41,'name'=>'batchTask:index','component'=>'batchTask/index',
                'path'=>'index','meta'=>['title'=>'批量上传','icon'=>'icon-upload','type'=>'C','hidden'=>false]]]];

        return response()->json(['success' => true, 'message' => 'ok', 'code' => 200, 'data' => $menus]);
    }

    
    public function userList(Request $request)
    {
        $page = $request->get('page', 1);
        $size = $request->get('pageSize', 20);
        $users = User::paginate($size, ['*'], 'page', $page);
        return response()->json([
            'success' => true, 'code' => 200,
            'data' => ['items' => $users->items(), 'total' => $users->total(), 'currentPage' => $page, 'pageSize' => $size]
        ]);
    }

    public function saveUser(Request $request)
    {
        $data = $request->only(['username','password','nickname','user_type','status']);
        if (isset($data['password'])) $data['password'] = Hash::make($data['password']);
        if ($request->has('id') && $request->id) {
            User::where('id', $request->id)->update($data);
        } else {
            User::create($data);
        }
        return response()->json(['success' => true, 'message' => '保存成功', 'code' => 200]);
    }

    public function deleteUser(Request $request)
    {
        User::whereIn('id', (array)$request->get('ids', []))->delete();
        return response()->json(['success' => true, 'message' => '删除成功', 'code' => 200]);
    }

    public function roleList()
    {
        return response()->json(['success' => true, 'code' => 200, 'data' => [
            ['id' => 1, 'name' => '超级管理员', 'code' => 'superAdmin'],
            ['id' => 2, 'name' => '管理员', 'code' => 'manager'],
            ['id' => 3, 'name' => '客户', 'code' => 'customer'],
        ]]);
    }

    public function getModuleList(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'data'=>[]]);
    }

    public function captcha(Request $request)
    {
        return response()->json(['success'=>true,'code'=>200,'data'=>['key'=>'nocaptcha','img'=>'']]);
    }

    public function emptyList(Request $request)
    {
        return response()->json(["success"=>true,"code"=>200,"data"=>["items"=>[],"total"=>0]]);
    }

    // ===== 问题3：账户批量操作 =====
    public function batchUpdateUserType(Request $request)
    {
        $ids      = (array)$request->get('ids', []);
        $userType = $request->get('user_type', 10);
        if (empty($ids)) return response()->json(['success'=>false,'code'=>400,'message'=>'请选择要操作的用户']);
        User::whereIn('id', $ids)->update(['user_type' => $userType]);
        return response()->json(['success'=>true,'code'=>200,'message'=>'角色批量更新成功','data'=>['count'=>count($ids)]]);
    }

    public function batchToggleStatus(Request $request)
    {
        $ids    = (array)$request->get('ids', []);
        $status = $request->get('status', 0); // 0=禁用 1=启用
        if (empty($ids)) return response()->json(['success'=>false,'code'=>400,'message'=>'请选择要操作的用户']);
        User::whereIn('id', $ids)->update(['status' => $status]);
        $action = $status == 1 ? '启用' : '禁用';
        return response()->json(['success'=>true,'code'=>200,'message'=>"批量{$action}成功",'data'=>['count'=>count($ids)]]);
    }

    public function batchDeleteUsers(Request $request)
    {
        $ids = (array)$request->get('ids', []);
        if (empty($ids)) return response()->json(['success'=>false,'code'=>400,'message'=>'请选择要删除的用户']);
        // 不允许删除自己或 admin(id=1)
        $ids = array_filter($ids, fn($id) => $id != 1);
        User::whereIn('id', $ids)->delete();
        return response()->json(['success'=>true,'code'=>200,'message'=>'批量删除成功','data'=>['count'=>count($ids)]]);
    }


}