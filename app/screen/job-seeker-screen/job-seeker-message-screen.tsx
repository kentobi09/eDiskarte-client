import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  StatusBar,
  Image,
  Platform,
  FlatList,
  KeyboardAvoidingView,
  SafeAreaView,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  Alert
} from 'react-native';
import { 
  ArrowLeft,
  MoreVertical,
  Paperclip,
  Send,
  Phone,
  Video,
  Info,
  AlertCircle,
  Bell,
  X,
  Trash2,
  UserX,
  Flag,
  DollarSign
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import ActionSheet from 'react-native-actionsheet';
import * as Clipboard from 'expo-clipboard';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Message = {
  id: string;
  chatId:string;
  messageContent: string|never;
  senderId: string;
  sentAt: string;
  deletedBySender: string;
  deletedByReceiver: string;  
  messageType: string| 'sent' | 'received' | 'system';
  senderPic?: string | "https://randomuser.me/api/portraits/men/1.jpg";
  isDelivered?: boolean;
  isSeen?: boolean;
  readBy?: ReadStatus[]
  sender?: {
    id: string;
    name: string;
  };
};

interface ReadStatus {
  id: string;
  messageId:string;
  readAt: Date | null;
  participantId: string;
  participant?: {
    id: string;
  };
}
type MenuOption = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
};
type ChatProps = {
  recipientId?: string;
  recipientName?: string;
  recipientPic?: string;
};

type Offer = {
  offerAmount: string;
  offerStatus: 'pending' | 'accepted' | 'rejected';
} | null;


const ChatScreen: React.FC<ChatProps> = ({ 
  recipientId = '1',
  recipientPic = 'https://randomuser.me/api/portraits/men/1.jpg'
}) => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [offerAmount, setOfferAmount] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const router = useRouter();
  const { chatId, receiverName,chatStatus,jobId,offerStatus,otherParticipantId} = useLocalSearchParams();
  const [currentOfferStatus, setOfferStatus] = useState(offerStatus);
  const [messageInput, setMessageInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participantName, setParticipantName] = useState(receiverName || "");
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const [currentChatStatus, setCurrentChatStatus] = useState(chatStatus);
  const [userType,setUserType] = useState('job-seeker')
  const [jobRequestId, setJobRequestId] = useState(jobId);
  const [currentOffer, setCurrentOffer] = useState<Offer>();
  const [visibleImageIndex, setVisibleImageIndex] = useState<number | null>(null);
  const [showOfferBanner, setShowOfferBanner] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
    
  const handleDeleteChat = (chatId: string) => {
    if(!socket) return;
    socket.emit('delete_chat', {
      chatId,
      userRole: 'job-seeker',
    });
     router.back();
  };
  const menuOptions: MenuOption[] = [
    { 
      icon: <Trash2 size={18} color="#777" />, 
      label: 'Delete conversation',
      onPress: () => handleDeleteChat(chatId as string)
    },
    { icon: <UserX size={18} color="#777" />, label: 'Block',onPress:undefined },
    { icon: <Flag size={18} color="#777" />, label: 'Report' ,onPress:undefined}
  ];
  const canDeleteForEveryone = (msg: any) => {
    if (!msg || !msg.sentAt) return false;
    const isSender = msg.senderId === currentUserId;
    const within3Minutes = Date.now() - new Date(msg.sentAt).getTime() <= 3 * 60 * 1000;
    return isSender && within3Minutes;
  };
  
  const handleLongPress = (message: any) => {
    setSelectedMessage(message);
    setActionSheetVisible(true);
    console.log("Long pressed message:", message); // Proper logging
  };
  
  const shouldHideMessage = (message:Message, currentUserId:any) => {
    const isSender = message.senderId === currentUserId;
    return isSender 
      ? message.deletedBySender === 'yes' 
      : message.deletedByReceiver === 'yes';
  };
      const handleAttachPress = async () => {
        try {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true, // ⚠️ Add this to get base64 string
          });
          if(!socket) return;
          if (!result.canceled) {
            const image = result.assets[0];
      
            const base64Image = `data:${image.type || 'image/jpeg'};base64,${image.base64}`;
      
            socket.emit('upload_image', {
              senderId: currentUserId,
              chatId: chatId,
              image: base64Image,
            });
          }
        } catch (error) {
          console.error("Error uploading image via socket:", error);
        }
      };

  const fetchInitialMessages = async (token: string) => {
    try {
      const response = await axios.get(`http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const messagesWithStatus = response.data.map((msg: Message) => ({
        ...msg,
        isDelivered: true, // Assume delivered if we're fetching from server
        isSeen: msg.readBy?.some(rs => rs.readAt !== null) || false
        
      }));
      // Sort messages in descending order (most recent first)
      const sortedMessages = messagesWithStatus.sort((a: Message, b: Message) => 
        new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
      );
      
      setMessages(sortedMessages);
      console.log(response);
      if(currentOfferStatus == 'pending') setOfferModalVisible(true);
      return sortedMessages;
    } catch (error) {
      console.error("Error fetching initial messages:", error);
      return [];
    }
  };
    
    const handleSendMessage = async (messageContent:string,messageType:string) => {
      console.log("hello?????????????");
      if (messageInput.trim() === "" || !socket) return;
  
      try {
        const newMessage = {
          chatId,
          messageContent: messageInput,
          messageType :  messageType
        };
  
        // Emit message through socket
        socket.emit('send_message', newMessage);
  
        // Clear input
        setMessageInput("");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    };
    const handleSystemMessage =(messageContent:string,messageType:string) => {
  
      if (!socket) return;
  
      try {
        const newMessage = {
          chatId,
          messageContent,
          messageType
        };
  
        // Emit message through socket
        socket.emit('send_message', newMessage);
  
        // Clear input
        setMessageInput("");
      } catch (error) {
        console.error("Error sending message:", error);
      }
    };
    const handleDeleteMessage = async (deletionType: 'forMe' | 'forEveryone') => {
      if (!selectedMessage) return;
    
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || !socket) throw new Error('No authentication');
    
        socket.emit('delete-message', {
          messageId: selectedMessage.id,
          chatId: selectedMessage.chatId,
          deletionType,
          isSender: selectedMessage.senderId === currentUserId
        });
    
        // Optimistic update
        setMessages(prev => prev.map(msg => 
          msg.id === selectedMessage.id
            ? {
                ...msg,
                ...(deletionType === 'forEveryone' 
                  ? { deletedBySender: 'yes', deletedByReceiver: 'yes' }
                  : { [selectedMessage.senderId === currentUserId ? 'deletedBySender' : 'deletedByReceiver']: 'yes' }
                ),
                messageContent: 'This message was deleted'
              }
            : msg
        ));
    
      } catch (error) {
        console.error('Delete failed:', error);
      }
    };


  const handleBack = () => {
    navigation.goBack();
  };

  const toggleModal = () => {
    if (modalVisible) {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      }).start(() => setModalVisible(false));
    } else {
      setModalVisible(true);
     
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      }).start();
    }
  };

  const openOfferModal = () => {
    setOfferModalVisible(true);
  };

  const closeOfferModal = () => {
    setOfferModalVisible(false);
  };

  const sendOffer = async () => {
    if (!offerAmount.trim() || !socket) return;
    setOfferStatus('pending');
    setCurrentOffer({
      offerAmount: offerAmount,
      offerStatus:"pending",
    });
    setOfferStatus('pending');  
    
    
    socket.emit("make_offer", {
      jobRequestId, 
      offerAmount: offerAmount,
      chatId,
    });
    handleSystemMessage(`Sent an offer ${offerAmount} pesos`,'system')

    
    setShowOfferBanner(true);
    
    setOfferAmount('');
    setOfferDescription('');
    setOfferModalVisible(false);
  };
  const formatTime = (dateString: string | number | Date) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true // For AM/PM format, set to false for 24-hour format
    });
  };


  //--------------------------------------------------------------------------
  //mga use effect dito hah

  useEffect(() => {
      // Initialize Socket.IO connection
      const initSocket = async () => {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          console.warn("No token found, redirecting to sign-in...");
          router.push("/sign_in");
          return;
        }
  
        // First, fetch initial messages via REST API
        await fetchInitialMessages(token);
  
        const newSocket = io(`http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000`, {
          auth: {
            token: token
          }
        });
        
  
        // Listen for new messages
        newSocket.on('receive_message', (message: Message) => {
          setMessages((prevMessages) => {
            // Prevent duplicate messages
            const isDuplicate = prevMessages.some(msg => msg.id === message.id);
            return isDuplicate 
              ? prevMessages 
              : [message, ...prevMessages];
          });
        });

  
        setSocket(newSocket);
  
        // Cleanup socket on component unmount
        return () => {
          newSocket.disconnect();
        };
      };
  
      // Fetch Current User ID
      const getCurrentUser = async () => {
        try {
          const storedUser = await AsyncStorage.getItem("currentUserId");
          if (!storedUser) {
            console.warn("⚠ No stored user found.");
            return;
          }
          setCurrentUserId(storedUser);
        } catch (error) {
          console.error("🚨 Error retrieving user:", error);
        }
      };
  
      getCurrentUser();
      initSocket();
    }, [chatId]);

     useEffect(() => {
     
          if (!socket){ 
            console.log('socket in receive message dont work')
            return;
          }
        
          // Handle incoming messages with status
          socket.on('receive_message', (message: Message) => {
            setMessages(prev => {
              // Prevent duplicates
              if (prev.some(m => m.id === message.id)) return prev;
              
              return [message, ...prev];
            });
          });
          // Handle seen update
          socket.on('message_seen', ({ messageId }) => {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId
                ? { ...msg, isSeen: true }
                : msg
            ));
          });

          socket.on('message_delivered', ({ messageId }) => {
            setMessages(prev => prev.map(msg => 
              msg.id === messageId
                ? { ...msg, isDelivered: true }
                : msg
            ));
          });

          socket.on("chat_approved", (data) => {
            if (data.status === "approved") {
              setCurrentChatStatus("approved"); 
            }
          });
      
          socket.on("chat_rejected", (data) => {
            if (data.status === "rejected") {
              setCurrentChatStatus("rejected"); 
            }
          });
        
          return () => {
            socket.off('receive_message');
            socket.off('message_seen');
            socket.off("chat_approved");
            socket.off("chat_rejected");
            socket.off('message_delivered');
          };
        }, [socket]);

  useEffect(() => {
      if (!socket) return;
      //dito
      socket.on("offer_rejected", ({ chatId, offerAmount ,offerStatus}) => {
      console.log("❌ Offer was rejected for chat:", chatId);
      console.log("New offer status:", offerStatus);
      console.log("The offer is",offerAmount);
      setCurrentOffer({
        offerAmount: offerAmount,
        offerStatus:offerStatus,
      });
      setOfferStatus(offerStatus);
      handleSystemMessage('The offer has been rejected','system')
          });
      socket.on("offer_accepted", ({ chatId, offerAmount ,offerStatus}) => {
            console.log("Offer was accepted for chat:", chatId);
            console.log("New offer status:", offerStatus);
            console.log("The offer is",offerAmount);
            setCurrentOffer({
              offerAmount: offerAmount,
              offerStatus:offerStatus,
            });
            setOfferStatus(offerStatus);
            handleSystemMessage('The offer has been accepted','system')
            
                });

          return () => {
            socket.off("offer_rejected");
            socket.off("offer_accepted");
          };
        }, [socket]);
        
                useEffect(() => {
                  if (!socket) {
                    console.log("Socket not connected! in this"); // Check if socket exists
                    return;
                  }
                  const handleMessageDeleted = (data: {
                    messageId: string;
                    updates: { deletedBySender?: string; deletedByReceiver?: string };
                    // newContent: string;
                  }) => {
                    setMessages(prev => {
                      const updated = prev.map(msg =>
                        msg.id === data.messageId
                          ? { ...msg, ...data.updates}
                          : msg
                      );
                      console.log('Updated messages:', updated); // <- See if the change is applied
                      return updated;
                    });
                  };
                
                  socket.on('message-deleted', handleMessageDeleted);
                
                  // ✅ Return a cleanup function that calls `.off`
                  return () => {
                    socket.off('message-deleted', handleMessageDeleted);
                  };
                }, [socket]);

              useEffect(() => {
                if (!socket) return;
              
                const handleMessagesRead = (data: {
                  messageIds: string[];
                  readStatuses: ReadStatus[];
                }) => {
                  setMessages(prev => prev.map(msg => {
                    if (!data.messageIds.includes(msg.id)) return msg;
              
                    const statusesForThisMessage = data.readStatuses.filter(
                      rs => rs.messageId === msg.id
                    );
              
                    const newReadStatuses: ReadStatus[] = statusesForThisMessage.map(rs => ({
                      id: rs.id,
                      messageId: rs.messageId,
                      participantId: rs.participantId,
                      readAt: rs.readAt
                    }));
              
                    return {
                      ...msg,
                      readBy: [
                        ...(msg.readBy || []),
                        ...newReadStatuses
                      ],
                      isSeen: statusesForThisMessage.some(rs => rs.readAt !== null)
                    };
                  }));
                };
              
                socket.on('messages_read', handleMessagesRead);
                return () => {
                  socket.off('messages_read', handleMessagesRead);
                };
              }, [socket]);

              useEffect(() => {
                if (!socket || !currentUserId || messages.length === 0) return;
              
                // 🔹 Tell backend user entered the chat screen
                socket.emit('mark_as_seen', { chatId });
              
                // 🔹 Check for unread messages from other participants
                const unreadMessages = messages.filter(
                  message =>
                    String(message.senderId) !== String(currentUserId) &&
                    (!message.readBy || message.readBy.length === 0)
                );
              
                if (unreadMessages.length > 0) {
                  const messageIds = unreadMessages.map(msg => msg.id);
                  socket.emit('mark_as_read', { chatId, messageIds });
                }
              
                // ✅ Listen for read updates from the backend
                socket.on('messages_read', ({ messageIds, readStatuses }) => {
                  setMessages(prevMessages =>
                    prevMessages.map(msg => {
                      if (messageIds.includes(msg.id)) {
                        return {
                          ...msg,
                          readBy: readStatuses
                            .filter((rs: { messageId: string; }) => rs.messageId === msg.id)
                            .map((rs: { participantId: any; readAt: any; }) => ({
                              participantId: rs.participantId,
                              readAt: rs.readAt,
                            })),
                        };
                      }
                      return msg;
                    })
                  );
                });
              
                // 🔁 Cleanup listener
                return () => {
                  socket.off('messages_read');
                };
              }, [messages, currentUserId, socket]);
              
  


  useEffect(() => {
    if (!socket || !chatId) return;
  
    // Join the chat when component mounts or chatId changes
    socket.emit('join_chat', { chatId });
    socket.emit('mark_as_seen', { chatId });
    return () => {
      // Leave the chat room when component unmounts or chatId changes
      socket.emit('leave_chat', { chatId });
    };
  }, [socket, chatId]);
  
  


  const renderMessageItem = ({ item,index}: { item: Message,index:number}) => {
    const isCurrentUser = String(item.senderId) === String(currentUserId);
    const isLastMessage = index === 0; // Since list is inverted
    const showStatus = isCurrentUser && isLastMessage;
    const messageDate = new Date(item.sentAt).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const currentMessageDate = new Date(item.sentAt).toDateString();
    const nextMessageDate = index === messages.length - 1
    ? null
    : new Date(messages[index + 1].sentAt).toDateString();
  
    const showDateSeparator = 
    index === messages.length - 1 || // First item at the bottom in inverted FlatList
    (nextMessageDate && currentMessageDate !== nextMessageDate);

    const statusText = 
    item.readBy && 
    Array.isArray(item.readBy) && 
    item.readBy.length > 0 && 
    item.readBy.some(rs => rs && rs.readAt !== null)
      ? 'Seen'
      : item.isDelivered
        ? 'Delivered'
        : '';

          if (item.messageType === 'system') {
            let customMessage = item.messageContent;
            const match = item.messageContent.match(/\d+/); // Finds the first number
            const amount = match ? match[0] : ''; // Extract the number or
            // Check if the message contains "client", "reject", and "message"
            if (item.messageContent.toLowerCase().includes('client') &&
                item.messageContent.toLowerCase().includes('rejected') &&
                item.messageContent.toLowerCase().includes('chat')) {
                
                customMessage = `${receiverName} rejected your chat request`; // Replace with the recipient's name
            }
            else if(item.messageContent.toLowerCase().includes('client') &&
            item.messageContent.toLowerCase().includes('accepted') &&
            item.messageContent.toLowerCase().includes('chat')) {
            
            customMessage = `${receiverName} accepted your chat request`;// Replace with the recipient's name
        }else if(item.messageContent.toLocaleLowerCase().includes('offer') &&
        item.messageContent.toLocaleLowerCase().includes('accepted')){
            customMessage = `${receiverName} accepted your offer`;
          }
        else if(item.messageContent.toLocaleLowerCase().includes('offer') &&
      !item.messageContent.toLocaleLowerCase().includes('rejected')){
          customMessage = `You sent an offer of ${amount} pesos`;
        }
        else if(item.messageContent.toLocaleLowerCase().includes('offer') &&
      item.messageContent.toLocaleLowerCase().includes('rejected')){
        customMessage = `${receiverName} rejected your offer`;
        }
        
            return (
                <View style={styles.systemMessageContainer}>
                    {showDateSeparator && (
                        <View style={styles.dateSeparator}>
                            <Text style={styles.dateText}>{messageDate}</Text>
                        </View>
                    )}
                    <View style={styles.systemMessageBubble}>
                        <Text style={styles.systemMessageText}>{customMessage}</Text>
                    </View>
                </View>
            );
        }
     const imageMessages = messages.filter((m) => {
      const isSender = m.senderId === currentUserId;
    
      // Exclude if deleted by the current user
      if (isSender && m.deletedBySender === 'yes') return false;
      if (!isSender && m.deletedByReceiver === 'yes') return false;
    
      return m.messageType === 'image';
    });
     const imageArray = imageMessages.map((msg) => {
       return `http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000/uploads/messages/${msg.messageContent.split("messages_files/")[1]}`;
     });
 
     if (item.messageType === 'image') {
       const imageUrl = `http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000/uploads/messages/${item.messageContent.split("messages_files/")[1]}`;
   
       const isDeletedForEveryone =
       item.deletedBySender === 'yes' && item.deletedByReceiver === 'yes';
     
     const isVisibleToUser = !shouldHideMessage(item, currentUserId) || isDeletedForEveryone;
     
     return isVisibleToUser ? (
       <View>
         {showDateSeparator && (
           <View style={styles.dateSeparator}>
             <Text style={styles.dateText}>{messageDate}</Text>
           </View>
         )}
     
         <View
           style={[
             styles.messageRow,
             isCurrentUser ? styles.sentMessageRow : styles.receivedMessageRow,
           ]}
         >
           {/* Avatar on left for received */}
           {!isCurrentUser && recipientPic && (
             <Image
               source={{ uri: recipientPic }}
               style={styles.senderAvatar}
               defaultSource={require("assets/images/client-user.png")}
             />
           )}
     
           {/* Image message */}
           <TouchableOpacity
             onLongPress={
               shouldHideMessage(item, currentUserId)
                 ? undefined
                 : () => handleLongPress(item)
             }
             delayLongPress={300}
             activeOpacity={1}
             disabled={shouldHideMessage(item, currentUserId)}
             onPress={() =>
               !shouldHideMessage(item, currentUserId) &&
               setVisibleImageIndex(index)
             }
           >
          {isDeletedForEveryone ? (
            <View style={styles.deletedImagePlaceholder}>
              <Text style={styles.deletedMessageText}>
                {item.senderId === currentUserId
                  ? 'You removed an image'
                  : `${receiverName ?? 'Someone'} removed an image`}
              </Text>
            </View>
          ) : (
            <>
              <Image
                source={{ uri: imageUrl }}
                style={styles.imageMessage}
                resizeMode="cover"
              />
                {showStatus && (
                      <Text style={styles.statusText}>
                        {statusText}
                      </Text>
                    )}
              <Text style={styles.imageTime}>{formatTime(item.sentAt)}</Text>
            </>
          )}
           </TouchableOpacity>
    
         </View>
     
         {/* Fullscreen Image Modal */}
         <Modal visible={visibleImageIndex !== null} transparent animationType="fade">
           <View style={styles.fullscreenContainer}>
             {visibleImageIndex !== null && (
               <>
                 <Image
                   source={{ uri: imageArray[visibleImageIndex] }}
                   style={styles.fullscreenImage}
                   resizeMode="contain"
                 />
     
                 <TouchableOpacity
                   style={styles.closeButton}
                   onPress={() => setVisibleImageIndex(null)}
                 >
                   <Text style={styles.buttonText}>✕</Text>
                 </TouchableOpacity>
     
                 {visibleImageIndex > 0 && (
                   <TouchableOpacity
                     style={styles.backButton}
                     onPress={() => setVisibleImageIndex(visibleImageIndex - 1)}
                   >
                     <Text style={styles.buttonText}>‹</Text>
                   </TouchableOpacity>
                 )}
     
                 {visibleImageIndex < imageArray.length - 1 && (
                   <TouchableOpacity
                     style={styles.nextButton}
                     onPress={() => setVisibleImageIndex(visibleImageIndex + 1)}
                   >
                     <Text style={styles.buttonText}>›</Text>
                   </TouchableOpacity>
                 )}
               </>
             )}
           </View>
         </Modal>
       </View>
     ) : null;
     
     }
 if (isCurrentUser) item.messageType = 'sent';
 else if(!isCurrentUser) item.messageType= 'received';

 const isDeletedForEveryone =
 item.deletedBySender === 'yes' && item.deletedByReceiver === 'yes';

const isVisibleToUser = !shouldHideMessage(item, currentUserId) || isDeletedForEveryone;

return isVisibleToUser ? (
 <View>
   {showDateSeparator && (
     <View style={styles.dateSeparator}>
       <Text style={styles.dateText}>{messageDate}</Text>
     </View>
   )}

   <View
     style={[
       styles.messageRow,
       item.messageType === 'sent' ? styles.sentMessageRow : styles.receivedMessageRow
     ]}
   >
     {item.messageType === 'received' && recipientPic && (
       <Image
         source={{ uri: recipientPic }}
         style={styles.senderAvatar}
         defaultSource={require('assets/images/client-user.png')}
       />
     )}

     <View
       style={[
         styles.messageBubble,
         item.messageType === 'sent' ? styles.sentBubble : styles.receivedBubble
       ]}
     >
       <TouchableOpacity
         onLongPress={
           isDeletedForEveryone ? undefined : () => handleLongPress(item)
         }
         delayLongPress={300}
         activeOpacity={1}
         disabled={isDeletedForEveryone}
       >
               {isDeletedForEveryone ? (
                 <Text style={styles.deletedMessageText}>
                   {item.senderId === currentUserId
                     ? 'You removed a message'
                     : `${receiverName ?? 'Someone'} removed a message`}
                 </Text>
               ) : (
                 <>
                   <Text
                     style={[
                       styles.messageText,
                       item.messageType === 'sent'
                         ? styles.sentMessageText
                         : styles.receivedMessageText
                     ]}
                   >
                     {item.messageContent}
                   </Text>
       
                   <Text
                     style={[
                       styles.messageTime,
                       item.messageType === 'sent'
                         ? styles.sentMessageTime
                         : styles.receivedMessageTime
                     ]}
                   >
                     {formatTime(item.sentAt)}
                   </Text>
                 </>
               )}
       </TouchableOpacity>
     </View>

     {/* {item.messageType === 'sent' && recipientPic && (
       <Image
         source={{ uri: recipientPic }}
         style={styles.senderAvatar}
         defaultSource={require('assets/images/client-user.png')}
       />
     )} */}
   </View>
   {showStatus && (
                      <Text style={styles.statusText}>
                        {statusText}
                      </Text>
                    )}
 </View>
) : null;

    
  };


  const modalScale = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1]
  });

  const modalOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  
  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
     
      <View style={[
        styles.header, 
        Platform.OS === 'ios' && styles.iosHeader,
        Platform.OS === 'android' && styles.androidHeader
      ]}>
        <TouchableOpacity onPress={handleBack}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        
        <View style={styles.headerUserInfo}>
          <Image 
            source={{ uri: recipientPic }} 
            style={styles.recipientAvatar} 
          />
          <Text style={styles.recipientName}>{receiverName}</Text>
        </View>
        
        <TouchableOpacity 
          onPress={toggleModal}
          style={styles.moreButton}
        >
          <MoreVertical size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
      {(currentOffer && currentOfferStatus =='pending') &&  showOfferBanner && (
        <View style={styles.offerNoticeBanner}>
          <DollarSign size={16} color="#fff" />
          <Text style={styles.offerNoticeText}>
            You've sent an offer of ${currentOffer.offerAmount}
          </Text>
        </View>
      )}
      
      {(currentOfferStatus === 'none'|| currentOfferStatus ==='rejected') && (
      <TouchableOpacity 
        style={styles.makeOfferButton}
        onPress={openOfferModal}
      >
        <DollarSign size={16} color="#0b216f" />
        <Text style={styles.makeOfferText}>Make Offer</Text>
      </TouchableOpacity>
        )}

      
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onRequestClose={toggleModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={toggleModal}
        >
          <Animated.View 
            style={[
              styles.dropdownMenu,
              { 
                opacity: modalOpacity,
                transform: [{ scale: modalScale }],
              }
            ]}
          >
            {menuOptions.map((option, index) => (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.menuOption,
                  index === menuOptions.length - 1 ? styles.lastMenuOption : null
                ]}
                onPress={() => {
                  toggleModal();
                  option.onPress?.();
                }}
              >
                <View style={styles.menuOptionIcon}>
                  {option.icon}
                </View>
                <Text style={styles.menuOptionText}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
      
      <Modal
        transparent
        visible={offerModalVisible}
        animationType="fade"
        onRequestClose={closeOfferModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.offerModalContainer}>
            <View style={styles.offerModalHeader}>
              <Text style={styles.offerModalTitle}>Make an Offer</Text>
              <TouchableOpacity onPress={closeOfferModal}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.offerModalContent}>
              <Text style={styles.offerLabel}>Amount ($)</Text>
              <TextInput
                style={styles.offerAmountInput}
                placeholder="Enter amount"
                value={offerAmount}
                onChangeText={setOfferAmount}
                keyboardType="numeric"
              />

              
              <TouchableOpacity 
                style={[
                  styles.sendOfferButton,
                  !offerAmount.trim() && styles.sendOfferButtonDisabled
                ]}
                onPress={sendOffer}
                disabled={!offerAmount.trim()}
              >
                <Text style={styles.sendOfferButtonText}>Send Offer</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
     
              <Modal
          visible={actionSheetVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setActionSheetVisible(false)}
        >
          <View style={styles.menumodalOverlay}>
            <View style={styles.menuactionSheet}>
              <TouchableOpacity
                style={styles.menuactionButton}
                onPress={() => {
                  if (selectedMessage?.messageContent) {
                    Clipboard.setStringAsync(selectedMessage.messageContent);
                  }
                  setActionSheetVisible(false);
                }}
              >
                <Text style={styles.menuactionText}>Copy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuactionButton, styles.menudeleteButton]}
                onPress={() => {
                  handleDeleteMessage('forMe');
                  setActionSheetVisible(false);
                }}
              >
                <Text style={[styles.menuactionText, styles.menudeleteText]}>Delete for me</Text>
              </TouchableOpacity>

              {canDeleteForEveryone(selectedMessage) && (
                <TouchableOpacity
                  style={[styles.menuactionButton, styles.menudeleteButton]}
                  onPress={() => {
                    handleDeleteMessage('forEveryone');
                    setActionSheetVisible(false);
                  }}
                >
                  <Text style={[styles.menuactionText, styles.menudeleteText]}>Delete for Everyone</Text>
                </TouchableOpacity>
              )}


              <TouchableOpacity
                style={styles.menucancelButton}
                onPress={() => setActionSheetVisible(false)}
              >
                <Text style={styles.menucancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>


      <FlatList
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={currentChatStatus === 'approved' ? renderEmptyChat : null}
        inverted={messages.length > 0}
        />
      
     
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        style={styles.inputContainer}
      >

      <TouchableOpacity style={styles.attachButton} onPress={handleAttachPress}>
        <Paperclip size={24} color="#999" />
      </TouchableOpacity>

        
        <TextInput
          style={styles.textInput}
          placeholder="Write a message..."
          value={messageInput}
          onChangeText={setMessageInput}
          multiline
        />
        
        <TouchableOpacity 
          style={[
            styles.sendButton,
            messageInput.trim().length === 0 && styles.sendButtonDisabled
          ]}
          onPress={() => handleSendMessage(messageInput, 'text')}
          disabled={messageInput.trim().length === 0}
        >
          <Send size={20} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
    zIndex: 10,
  },
  iosHeader: {
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
  },
  androidHeader: {
    marginTop: StatusBar.currentHeight || 0,
    paddingTop: 20,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  moreButton: {
    padding: 8,
  },
  // Offer notice banner
  offerNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b216f',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  offerNoticeText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 8,
    flexShrink: 1,
  },
  makeOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  makeOfferText: {
    marginLeft: 5,
    color: '#0b216f',
    fontWeight: '500',
    fontSize: 15,
  },
  messageList: {
    padding: 10,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  sentMessageRow: {
    justifyContent: 'flex-end',
  },
  receivedMessageRow: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 8,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 18,
    maxWidth: '70%',
  },
  sentBubble: {
    backgroundColor: '#0b216f', 
    borderBottomRightRadius: 5,
    marginRight:5,
  },
  receivedBubble: {
    backgroundColor: '#e9e9eb', 
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  sentMessageText: {
    color: '#fff',
  },
  receivedMessageText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  sentMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  receivedMessageTime: {
    color: '#8e8e93',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginBottom: Platform.OS === 'ios' ? 0 : 0,
    paddingBottom: Platform.OS === 'android' ? 55 : 55,
  },
  attachButton: {
    padding: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f2f2f7',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0b216f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#b0c0e0',
  },
  // Dropdown menu styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    right: 15,
    width: SCREEN_WIDTH * 0.6, 
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastMenuOption: {
    borderBottomWidth: 0,
  },
  menuOptionIcon: {
    marginRight: 12,
  },
  menuOptionText: {
    fontSize: 16,
    color: '#333',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8e8e93',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },
  
  offerModalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_WIDTH * 1.1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  offerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  offerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  offerModalContent: {
    padding: 15,
    maxHeight: 400,
  },
  offerLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    marginTop: 10,
  },
  offerAmountInput: {
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  offerDescriptionInput: {
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    height: 100,
    textAlignVertical: 'top',
  },
  sendOfferButton: {
    backgroundColor: '#0b216f',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  sendOfferButtonDisabled: {
    backgroundColor: '#b0c0e0',
  },
  sendOfferButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateSeparator: {
    alignSelf: "center",
    backgroundColor: "#e0e0e0",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  dateText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#555",
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
  },
  systemMessageTime: {
    fontSize: 11,
    color: '#8e8e93',
    textAlign: 'center',
    marginTop: 2,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  sentMessageContainer: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  receivedMessageContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  imageMessageBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    backgroundColor: '#f0f0f0', // You can change this color for sent and received
    overflow: 'hidden',
    marginRight:3,
  },
  imageMessage: {
    width: 250, // Adjust width for your design
    height: 150, // Adjust height for your design
    borderRadius: 12,
    marginRight:3,
  },
  modalCloseArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 30,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 30,
  },
  nextButton: {
    position: 'absolute',
    right: 20,
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 30,
  },
  buttonText: {
    fontSize: 24,
    color: 'white',
  },
  imageTime: {
    fontSize: 12,
    color: 'gray',
    alignSelf: 'flex-end',
    marginTop: 2,
    marginRight:3,
  },

  menumodalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuactionSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  menuactionButton: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuactionText: {
    fontSize: 18,
    textAlign: 'center',
  },
  menudeleteButton: {
    marginTop: 8,
  },
  menudeleteText: {
    color: 'red',
  },
  menucancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  menucancelText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#007AFF',
  },
  deletedMessageText: {
    fontStyle: 'italic',
    color: '#999',
  },
  deletedMessageTime: {
    opacity: 0.6, // Make timestamp slightly faded for deleted messages
  },
  deletedImagePlaceholder: {
    width: 200, // Match your image width
    height: 200, // Match your image height
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    color: '#555', // Dark grey, better contrast
    alignSelf: 'flex-end',
    marginTop: -15,
    marginRight: 5,
  }
});

export default ChatScreen;