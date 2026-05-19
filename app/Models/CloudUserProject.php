<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class CloudUserProject extends Model {
    protected $table = 'cloud_user_project';
    protected $fillable = ['user_id','project_id','created_at','updated_at'];
    public $timestamps = false;
}
