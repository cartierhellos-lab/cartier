<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ReceivedMessage extends Model {
    protected $table = 'cloud_received_message';
    protected $fillable = ['phoneinfo_id','system_phonenumber','sender_phonenumber','content','message_type','is_read','conversation_id','received_at','created_at'];
    public $timestamps = false;
}
