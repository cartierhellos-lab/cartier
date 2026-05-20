<?php
namespace App\Http\Controllers\Cloud;

use App\Http\Controllers\Controller;
use App\Models\PhoneInfo;
use App\Models\CloudProject;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PhoneInfoController extends Controller
{
    public function index(Request $request)
    {
        $page = $request->get('page', 1);
        $size = $request->get('pageSize', 20);
        $query = PhoneInfo::whereNull('deleted_at');
        if ($request->has('project_id') && $request->project_id) {
            $query->where('project_id', $request->project_id);
        }
        if ($request->has('online_status') && $request->online_status !== null) {
            $query->where('online_status', $request->online_status);
        }
        if ($request->has('keyword') && $request->keyword) {
            $query->where('myphonenumber', 'like', '%'.$request->keyword.'%');
        }
        $items = $query->paginate($size, ['*'], 'page', $page);
        return response()->json([
            'success' => true, 'code' => 200,
            'data' => ['items' => $items->items(), 'total' => $items->total(), 'currentPage' => $page, 'pageSize' => $size]
        ]);
    }

    public function save(Request $request)
    {
        $data = $request->only([
            'myphonenumber','phone','cookie','device_info','user_name',
            'account_type','is_service','xpx','idfa','client_id','status','project_id'
        ]);
        $data['updated_at'] = now();
        if ($request->has('id') && $request->id) {
            PhoneInfo::where('id', $request->id)->update($data);
        } else {
            $data['created_at'] = now();
            PhoneInfo::create($data);
        }
        return response()->json(['success' => true, 'message' => '保存成功', 'code' => 200]);
    }

    public function delete(Request $request)
    {
        PhoneInfo::whereIn('id', (array)$request->get('ids', []))->update(['deleted_at' => now()]);
        return response()->json(['success' => true, 'message' => '删除成功', 'code' => 200]);
    }

    public function import(Request $request)
    {
        if (!$request->hasFile('file')) {
            return response()->json(['success' => false, 'message' => '请上传文件', 'code' => 1002]);
        }
        $project = CloudProject::where('is_select', 1)->first();
        $projectId = $project ? $project->id : null;

        $file = $request->file('file');
        $path = $file->storeAs('imports', 'phoneinfo_' . time() . '.' . $file->getClientOriginalExtension());
        $fullPath = storage_path('app/' . $path);

        try {
            $accounts = $this->parseExcelFile($fullPath);
            $imported = 0;
            foreach ($accounts as $acc) {
                if (empty($acc['myphonenumber'])) continue;
                $exist = PhoneInfo::where('myphonenumber', $acc['myphonenumber'])->whereNull('deleted_at')->first();
                if (!$exist) {
                    $acc['project_id'] = $projectId;
                    $acc['created_at'] = now();
                    $acc['updated_at'] = now();
                    PhoneInfo::create($acc);
                    $imported++;
                }
            }
            return response()->json(['success' => true, 'message' => "成功导入 {$imported} 条", 'code' => 200, 'data' => ['count' => $imported]]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => '导入失败: ' . $e->getMessage(), 'code' => 500]);
        }
    }

    private function parseExcelFile($path)
    {
        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $accounts = [];
        if (in_array($ext, ['xlsx', 'xls'])) {
            // 使用PhpSpreadsheet解析
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
            $sheet = $spreadsheet->getActiveSheet();
            $headers = [];
            $rowIndex = 0;
            foreach ($sheet->getRowIterator() as $row) {
                $cells = [];
                foreach ($row->getCellIterator() as $cell) {
                    $cells[] = trim((string)$cell->getValue());
                }
                if ($rowIndex === 0) {
                    $headers = $cells;
                } else {
                    if (array_filter($cells)) {
                        $record = [];
                        foreach ($headers as $i => $h) {
                            $record[$h] = $cells[$i] ?? '';
                        }
                        $accounts[] = $this->mapFields($record);
                    }
                }
                $rowIndex++;
            }
        }
        return $accounts;
    }

    private function mapFields($row)
    {
        // 映射两种文件格式
        $map = [
            '账号' => 'myphonenumber', 'email' => 'myphonenumber',
            'cookie' => 'cookie', 'Cookie' => 'cookie',
            'device_info' => 'device_info', 'User-Agent' => 'device_info',
            'user_name' => 'user_name', 'username' => 'user_name',
            '手机号码' => 'phone', 'phone' => 'phone',
            'xpx' => 'xpx', 'X-PX-AUTHORIZATION' => 'xpx',
            'IDFA' => 'idfa', 'clientId' => 'client_id',
        ];
        $result = ['account_type' => 'tn', 'status' => 1, 'online_status' => 0];
        foreach ($map as $from => $to) {
            if (isset($row[$from]) && !empty($row[$from])) {
                $result[$to] = str_replace("\t", "", $row[$from]);
            }
        }
        if (empty($result['myphonenumber']) && isset($row['账号'])) {
            $result['myphonenumber'] = str_replace("\t", "", $row['账号']);
        }
        return $result;
    }

    public function export(Request $request)
    {
        $items = PhoneInfo::whereNull('deleted_at')->get();
        return response()->json(['success' => true, 'code' => 200, 'data' => $items]);
    }

    public function updateStatus(Request $request)
    {
        PhoneInfo::whereIn('id', (array)$request->get('ids', []))->update(['status' => $request->get('status', 1)]);
        return response()->json(['success' => true, 'message' => '更新成功', 'code' => 200]);
    }
}
