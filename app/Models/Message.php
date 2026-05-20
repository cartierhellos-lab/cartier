<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Message extends Model {
    protected $table = 'tcard_message';
    protected $fillable = [
        'conversation_id',
        'content',
        'message_type',
        'direction',
        'status',
        'is_read',
        'message_time',
        'sender',
        'receiver',
        'error_msg',
        'created_by',
        'created_at',
        'updated_at',
    ];
    public $timestamps = false;

    public function conversation()
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }
}
