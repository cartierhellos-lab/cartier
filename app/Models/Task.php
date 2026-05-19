<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Task extends Model {
    protected $table = 'tcard_task';
    protected $fillable = ['task_name','project_id','project_key','user_id','content','message_type','total_count','success_count','fail_count','status','started_at','finished_at','created_at','updated_at','deleted_at'];
    public $timestamps = false;
}
