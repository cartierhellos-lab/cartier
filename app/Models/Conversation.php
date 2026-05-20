<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model {
    protected $table = 'tcard_conversation';
    protected $fillable = ['project_id','project_key','phoneinfo_id','system_phonenumber','target_phonenumber','user_id','status','last_message','last_message_at','unread_count','created_at','updated_at','deleted_at'];
    public $timestamps = false;
}
