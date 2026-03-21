import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer

class MatchmakingQueue:
    waiting_users = []

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = None
        
        await self.accept()

        if MatchmakingQueue.waiting_users:
            peer = MatchmakingQueue.waiting_users.pop(0)
            self.room_group_name = peer['room']
            
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_message',
                    'message': 'Connected to a stranger.',
                    'status': 'connected'
                }
            )
        else:
            self.room_group_name = f"chat_{uuid.uuid4().hex}"
            MatchmakingQueue.waiting_users.append({
                'channel': self.channel_name,
                'room': self.room_group_name
            })
            
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            await self.send(text_data=json.dumps({
                'type': 'system_message',
                'message': 'Looking for a stranger...',
                'status': 'waiting'
            }))

    async def disconnect(self, close_code):
        MatchmakingQueue.waiting_users = [
            u for u in MatchmakingQueue.waiting_users if u['channel'] != self.channel_name
        ]
        
        if self.room_group_name:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_message',
                    'message': 'Stranger has disconnected.',
                    'status': 'disconnected'
                }
            )
            
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json.get('message', '')

        if self.room_group_name and message:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': self.channel_name
                }
            )

    async def chat_message(self, event):
        message = event['message']
        sender = event['sender']
        
        is_me = (sender == self.channel_name)

        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': message,
            'is_me': is_me
        }))
        
    async def system_message(self, event):
        message = event['message']
        status = event['status']
        await self.send(text_data=json.dumps({
            'type': 'system_message',
            'message': message,
            'status': status
        }))
