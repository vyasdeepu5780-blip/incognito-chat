import json
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer

class MatchmakingQueue:
    waiting_users = []

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = None
        self.role = None  # Store if this user is 'X' or 'O'
        
        await self.accept()

        if MatchmakingQueue.waiting_users:
            # Join an existing room as player 'O'
            peer = MatchmakingQueue.waiting_users.pop(0)
            self.room_group_name = peer['room']
            self.role = 'O'
            
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            # Notify both that connection is successful
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_broadcast',
                    'message': 'Connected to a stranger.',
                    'status': 'connected'
                }
            )
        else:
            # Create a new room as player 'X'
            self.room_group_name = f"chat_{uuid.uuid4().hex}"
            self.role = 'X'
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
                'status': 'waiting',
                'role': self.role
            }))

    async def disconnect(self, close_code):
        MatchmakingQueue.waiting_users = [
            u for u in MatchmakingQueue.waiting_users if u['channel'] != self.channel_name
        ]
        
        if self.room_group_name:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'system_broadcast',
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
        msg_type = text_data_json.get('type')
        
        if msg_type == 'game_move':
            if self.room_group_name:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_message',
                        'index': text_data_json.get('index'),
                        'symbol': self.role # Always use the server-assigned role for security
                    }
                )
        else:
            # Handle regular chat messages
            message = text_data_json.get('message', '')
            if self.room_group_name and message:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_broadcast',
                        'message': message,
                        'sender_channel': self.channel_name
                    }
                )

    # --- Group Handlers ---

    async def chat_broadcast(self, event):
        is_me = (event['sender_channel'] == self.channel_name)
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'is_me': is_me
        }))
        
    async def game_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_move',
            'index': event['index'],
            'symbol': event['symbol']
        }))
        
    async def system_broadcast(self, event):
        # We include the role in the final connect message so script.js knows who is X/O
        await self.send(text_data=json.dumps({
            'type': 'system_message',
            'message': event['message'],
            'status': event['status'],
            'role': self.role
        }))