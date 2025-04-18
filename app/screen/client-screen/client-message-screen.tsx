import React, { useState, useEffect,useRef } from 'react';
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
  Alert,
  AppState
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
  Check,
  XCircle,
  User,
  DollarSign,
  Rss
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter,useGlobalSearchParams } from "expo-router";
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
  readAt: Date | String | null;
  participantId: string;
  participant?: {
    id: string;
    // Add other participant fields if needed
  };
}

type ChatProps = {
  recipientId?: string;
  recipientName?: string;
  recipientPic?: string;
  chatRequestStatus?: 'pending' | 'accepted' | 'rejected';
};
type MenuOption = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
};


const ChatScreen: React.FC<ChatProps> = ({ 
  recipientId = '1',
  recipientName = 'Ken Robbie Galapate', 
  recipientPic = 'https://randomuser.me/api/portraits/men/1.jpg',
  chatRequestStatus = 'pending'
}) => {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [acceptOfferConfirmationVisible, setAcceptOfferConfirmationVisible] = useState(false);
  const router = useRouter();
  const { chatId, receiverName,chatStatus,jobId,offer,offerStatus,otherParticipantId} = useLocalSearchParams();
  const [offerAmount,setOfferAmount] = useState(offer); // Define the money offer amount
  const [currentOfferStatus, setOfferStatus] = useState(offerStatus);
  const [messageInput, setMessageInput] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [participantName, setParticipantName] = useState(receiverName || "");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [currentChatStatus, setCurrentChatStatus] = useState(chatStatus);
  const [jobRequestId, setJobRequestId] = useState(jobId);
  const [userType,setUserType] = useState('client')
  const actionSheetRef = useRef<any>();
  const [modalVisible, setModalVisible] = useState(false);
  const [visibleImageIndex, setVisibleImageIndex] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [statusText, setStatusText] = useState('');

  const getStatusText = (item:any) => {
    if (
      item.readBy &&
      Array.isArray(item.readBy) &&
      item.readBy.length > 0 &&
      item.readBy.some((rs: { readAt: null; }) => rs && rs.readAt !== null)
    ) {
      return 'Seen';
    }
    return item.isDelivered ? 'Delivered' : '';
  };
  const handleDeleteChat = (chatId: string) => {
    if(!socket) return;
    socket.emit('delete_chat', {
      chatId,
      userRole: 'client',
    });
    router.back();
  };

  const canDeleteForEveryone = (msg: any) => {
    if (!msg || !msg.sentAt) return false;
    const isSender = msg.senderId === currentUserId;
    const within3Minutes = Date.now() - new Date(msg.sentAt).getTime() <= 3 * 60 * 1000;
    return isSender && within3Minutes;
  };
  
  const shouldHideMessage = (message:Message, currentUserId:any) => {
    const isSender = message.senderId === currentUserId;
    return isSender 
      ? message.deletedBySender === 'yes' 
      : message.deletedByReceiver === 'yes';
  };
  
  
  const handleLongPress = (message: any) => {
    setSelectedMessage(message);
    setActionSheetVisible(true);
    console.log("Long pressed message:", message); // Proper logging
  };
  
  const handleAttachPress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true, // ⚠️ Add this to get base64 string
      });
      if(!socket) return
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
  
  
  

  // 2. Handle option selected (camera or gallery)
  const handleOptionPress = async (index: number) => {
    if (index === 0) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled) {
        console.log("📷 Camera image:", result.assets[0].uri);
      }
    } else if (index === 1) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled) {
        console.log("🖼️ Gallery image:", result.assets[0].uri);
      }
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
  
  const handleSendMessage = async () => {
    console.log("hello?????????????");
    if (messageInput.trim() === "" || !socket) return;

    try {
      const newMessage = {
        chatId,
        messageContent: messageInput,
        messageType : 'text'
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

  const handleApprove = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000/chats/${chatId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentChatStatus('approved');
      handleSystemMessage('Client accepted the chat request','system')
    } catch (error) {
      console.error("Error approving chat:", error);
    }
  };
  
  const handleReject = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000/chats/${chatId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleSystemMessage('Client rejected the chat request','system')
      setCurrentChatStatus('rejected');
      setShowApprovalModal(false);
      router.back(); // Optionally navigate back after rejection
    } catch (error) {
      console.error("Error rejecting chat:", error);
    }
  };

  
  
  
  
  //-----------------------------------------------------------------------------------------------------------------
  //mga use effect dito pocha
  // Initialize with mock conversation

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
    

      
      newSocket.on("client_offer_notification", (data) => {
        console.log("📩 Offer Receiveds :", data);
        setOfferAmount(data.offerAmount);
        setOfferStatus(data.status);
        setOfferModalVisible(true);
       
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
      if (!socket) return;
    
      // Handle incoming messages with status
      socket.on('receive_message', (message: Message) => {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === message.id)) return prev;
          
          return [message, ...prev];
        });
      });
    
      socket.on('message_seen', ({ messageId, readStatus }) => {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId
            ? { 
                ...msg, 
                readBy: [...(msg.readBy || []), readStatus],
                isSeen: true
              }
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
      const checkChatStatus = async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          const response = await axios.get(`http://${process.env.EXPO_PUBLIC_IP_ADDRESS}:3000/chats/${chatId}/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentChatStatus(response.data.status);
          
          // Show modal if current user is client and status isn't approved
          const ua = await AsyncStorage.getItem("userType");
          setUserType(ua+'');
          if (userType === 'client' && response.data.status !== 'approved') {
            setShowApprovalModal(true);
          }
        } catch (error) {
          console.error("Error checking chat status:", error);
        }
      };
    
      checkChatStatus();
    }, [chatId]);
    useEffect(() => {
      if (!socket) return;
            
             
            socket.on("offer_rejected", ({ chatId, offerAmount ,offerStatus}) => {
            console.log("❌ Offer was rejected for chat:", chatId);
            console.log("New offer status:", offerStatus);
            console.log("The offer is",offerAmount);
            setOfferAmount(offerAmount);
            setOfferStatus(offerStatus);
                });
            socket.on("offer_accepted", ({ chatId, offerAmount ,offerStatus}) => {
                  console.log("Offer was accepted for chat:", chatId);
                  console.log("New offer status:", offerStatus);
                  console.log("The offer is",offerAmount);
                              setOfferAmount(offerAmount);
            setOfferStatus(offerStatus);
                  
                      });
      
                return () => {
                  socket.off("offer_rejected");
                  socket.off("offer_accepted");
                };
              }, [socket]);
  
              useEffect(() => {
                if(!socket) return;
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
                if (!socket || !chatId) return;
              
                // Join the chat when component mounts or chatId changes
                socket.emit('join_chat', { chatId });
                
                socket.emit('mark_as_seen', { chatId });
                return () => {
                  // Leave the chat room when component unmounts or chatId changes
                  socket.emit('leave_chat', { chatId });
                };
              }, [socket, chatId]);
    
              
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
              
        


                        

    
  const getPendingMenuOptions = (): MenuOption[] => [
    { icon: <User size={18} color="#777" />, label: 'View Profile', onPress: undefined }
  ];
  
  const getAcceptedMenuOptions = (): MenuOption[] => [
    { 
      icon: <Trash2 size={18} color="#777" />, 
      label: 'Delete conversation',
      onPress: () => handleDeleteChat(chatId as string)
    },
    { icon: <UserX size={18} color="#777" />, label: 'Block', onPress: undefined },
    { icon: <Flag size={18} color="#777" />, label: 'Report', onPress: undefined },
  ];

  const handleBack = () => {
    navigation.goBack();
  };

  const toggleMenuModal = () => {
    if (menuModalVisible) {
    
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      }).start(() => setMenuModalVisible(false));
    } else {
      setMenuModalVisible(true);
     
      Animated.timing(modalAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true
      }).start();
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
  const handleAcceptChat = () => { 
    handleApprove()
    setCurrentChatStatus("approved")
    setMenuModalVisible(false)
    // Show offer modal after accepting chat
    setTimeout(() => {
      setOfferModalVisible(true);
    }, 500);
  };

  const handleRejectChat = () => {
    setRejectModalVisible(true);
  };

  const confirmRejectChat = () => {
    handleReject()
    setCurrentChatStatus("rejected");
    setRejectModalVisible(false);
    
    setTimeout(() => {
      navigation.goBack();
    }, 500);
  };

  const handleInitiateAcceptOffer = () => {
    setAcceptOfferConfirmationVisible(true);
  };

  const handleAcceptOffer = () => {
    if(!socket) return;

    socket.emit('accept_offer', { chatId,jobRequestId }, () => {

    });
    setAcceptOfferConfirmationVisible(false);

    setOfferStatus('accepted');
    setOfferModalVisible(false);
    
  };

  const handleRejectOffer = async () => {
    if(!socket) return;
    socket.emit('reject_offer', { chatId }, () => {});
    setOfferStatus('rejected');
    setOfferModalVisible(false);
    
  };

  const formatTime = (dateString: string | number | Date) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true 
    });
  };

  

  const renderMessageItem = ({ item, index }: { item: Message; index: number }) => {
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
    index === messages.length - 1 || (nextMessageDate && currentMessageDate !== nextMessageDate);
    
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
                
                customMessage = `You rejected ${receiverName ?? 'the recipient'}'s chat request`; // Replace with the recipient's name
            }
            else if(item.messageContent.toLowerCase().includes('client') &&
            item.messageContent.toLowerCase().includes('accepted') &&
            item.messageContent.toLowerCase().includes('chat')) {
            
            customMessage = `You accepted ${receiverName ?? 'the recipient'}'s chat request`; // Replace with the recipient's name
        }else if(item.messageContent.toLocaleLowerCase().includes('offer') &&
        item.messageContent.toLocaleLowerCase().includes('accepted')){
            customMessage = `You accepted the offer`;
          }
        else if(item.messageContent.toLocaleLowerCase().includes('offer') &&
      !item.messageContent.toLocaleLowerCase().includes('rejected')){
          customMessage = `${receiverName} sent an offer of ${amount} pesos`;
        }
        else if(item.messageContent.toLocaleLowerCase().includes('offer') &&
      item.messageContent.toLocaleLowerCase().includes('rejected')){
          customMessage = `You rejected the offer`;
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
                    {/* {formatTime(item.sentAt)} */}


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

  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubtext}>Send a message to start the conversation</Text>
    </View>

  );

  const modalScale = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1]
  });

  const modalOpacity = modalAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });


  const menuOptions = currentChatStatus  === 'approved' ? getAcceptedMenuOptions() : getPendingMenuOptions();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[
        styles.header, 
        Platform.OS === 'ios' ? styles.iosHeader : styles.androidHeader
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
          onPress={toggleMenuModal}
          style={styles.moreButton}
        >
          <MoreVertical size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
      {currentChatStatus === 'pending' && (
        <View style={styles.requestBanner}>
          <Text style={styles.requestText}>
            Chat request from {receiverName}
          </Text>
          <View style={styles.requestActions}>
            <TouchableOpacity 
              style={styles.rejectButton}
              onPress={handleRejectChat}
            >
              <XCircle size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={handleAcceptChat}
            >
              <Check size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {currentChatStatus  === 'approved' && currentOfferStatus == 'pending' && offerModalVisible && (
        <View style={styles.offerBanner}>
          <View style={styles.offerContent}>
            <DollarSign size={24} color="#0b8043" style={styles.offerIcon} />
            <View style={styles.offerTextContainer}>
              <Text style={styles.offerTitle}>Payment Offer: {offerAmount}</Text>
              <Text style={styles.offerDescription}>
                {receiverName} has sent you a payment offer. Would you like to accept?
              </Text>
            </View>
          </View>
          <View style={styles.offerActions}>
            <TouchableOpacity 
              style={styles.offerRejectButton}
               onPress={handleRejectOffer}
            >
              <XCircle size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.offerAcceptButton}
              onPress={handleInitiateAcceptOffer}
            >
              <Check size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Offer Acceptance Confirmation Modal */}
      <Modal
        transparent
        visible={acceptOfferConfirmationVisible}
        animationType="fade"
        onRequestClose={() => setAcceptOfferConfirmationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>
            <Text style={styles.confirmModalTitle}>Accept Offer?</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to accept the {offerAmount} payment offer from {receiverName}?
            </Text>
            <Text style={styles.warningText}>
              There's no turning back once you accept this offer.
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setAcceptOfferConfirmationVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.acceptConfirmButton}
                onPress={handleAcceptOffer}
              >
                <Text style={styles.confirmButtonText}>Yes, Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Modal
        transparent
        visible={rejectModalVisible}
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModalContainer}>
            <Text style={styles.rejectModalTitle}>Reject Chat?</Text>
            <Text style={styles.rejectModalText}>
              Are you sure you want to reject this chat request from {receiverName}?
            </Text>
            <View style={styles.rejectModalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmRejectChat}
              >
                <Text style={styles.confirmButtonText}>Yes, Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      <Modal
        transparent
        visible={menuModalVisible}
        animationType="none"
        onRequestClose={toggleMenuModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={toggleMenuModal}
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
                  toggleMenuModal();
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

      
      {currentChatStatus  === 'approved' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
          style={styles.inputContainer}
        >
 <TouchableOpacity style={styles.attachButton} onPress={handleAttachPress}>
        <Paperclip size={24} color="#999" />
      </TouchableOpacity>

      <ActionSheet
        ref={actionSheetRef}
        title={'Attach Image'}
        options={['Take Photo', 'Choose from Gallery', 'Cancel']}
        cancelButtonIndex={2}
        onPress={handleOptionPress}
      />
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
            onPress={handleSendMessage}
            disabled={messageInput.trim().length === 0}
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}
      
      {currentChatStatus  === 'rejected' && (
        <View style={styles.rejectedContainer}>
          <AlertCircle size={50} color="#ff3b30" />
          <Text style={styles.rejectedText}>
            You've rejected this chat request
          </Text>
        </View>
      )}
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
    paddingTop: 25,
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
  messageList: {
    flexGrow: 1,
    paddingVertical: 10,
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
  requestBanner: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  requestText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
  },
  acceptButton: {
    backgroundColor: '#34c759', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 100,
  },
  rejectButton: {
    backgroundColor: '#ff3b30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 100,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 5,
  },
  rejectModalContainer: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  confirmModalContainer: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rejectModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0b8043',
  },
  rejectModalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  confirmModalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#666',
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#ff3b30',
    fontWeight: '500',
  },
  rejectModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    backgroundColor: '#0b8043',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  rejectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  rejectedText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
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
  offerBanner: {
    backgroundColor: '#f0f8f0',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  offerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  offerIcon: {
    marginRight: 10,
  },
  offerTextContainer: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b8043',
    marginBottom: 4,
  },
  offerDescription: {
    fontSize: 14,
    color: '#666',
  },
  offerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  offerAcceptButton: {
    backgroundColor: '#0b8043', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 100,
  },
  offerRejectButton: {
    backgroundColor: '#8e8e93', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 100,
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
    marginRight:3
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
messageStatusText: {
  fontSize: 12,
  color: '#888',
  marginTop: 4,
  textAlign: 'right'
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